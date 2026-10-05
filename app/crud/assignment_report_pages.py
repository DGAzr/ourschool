"""Bounded report browsing and a separate streaming CSV export."""

import csv
import io

from fastapi import HTTPException
from sqlalchemy import func, case, String, and_, or_
from sqlalchemy.orm import aliased

from app.crud.assignment_reads import (
    A,
    T,
    assignment_base,
    scoped_filters,
    term_filter,
    encode_cursor,
    after_date,
)
from app.crud import settings as crud_settings
from app.crud.reports.shared import calculation_note
from app.utils.grading import compute_weighted_grade
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.models.term import Term
from app.utils.grading import assignment_status_filter
from app.utils.request_performance import record_rows


def report_query(db, subject_id=None, student_id=None, term_id=None, status=None):
    query = scoped_filters(
        assignment_base(db), subject_id=subject_id, student_id=student_id
    )
    if term_id is not None:
        term = db.query(Term).filter(Term.id == term_id).first()
        if term is None:
            raise HTTPException(404, "Term not found")
        query = query.filter(term_filter(term, "effective"))
    if status:
        try:
            query = query.filter(assignment_status_filter(status))
        except ValueError:
            raise HTTPException(422, "Invalid assignment status")
    return query


def options(db):
    return dict(
        available_subjects=[
            dict(r._mapping)
            for r in db.query(Subject.id, Subject.name, Subject.color)
            .order_by(Subject.name)
            .all()
        ],
        available_students=[
            dict(r._mapping)
            for r in db.query(
                User.id, func.concat(User.first_name, " ", User.last_name).label("name")
            )
            .filter(User.role == UserRole.STUDENT)
            .order_by(User.first_name, User.last_name, User.id)
            .all()
        ],
        available_terms=[
            dict(r._mapping)
            for r in db.query(Term.id, Term.name, Term.academic_year)
            .order_by(Term.start_date.desc(), Term.id.desc())
            .all()
        ],
    )


def projection(query, feedback=False):
    actor = aliased(User)
    return (
        query.join(Subject, T.subject_id == Subject.id)
        .outerjoin(actor, A.assigned_by == actor.id)
        .with_entities(
            A.id.label("assignment_id"),
            A.template_id,
            T.name.label("assignment_name"),
            T.assignment_type,
            A.student_id,
            func.concat(User.first_name, " ", User.last_name).label("student_name"),
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            Subject.color.label("subject_color"),
            A.assigned_date,
            A.due_date,
            A.extended_due_date,
            A.status,
            A.points_earned,
            func.coalesce(A.custom_max_points, T.max_points).label("max_points"),
            A.percentage_grade,
            A.letter_grade,
            A.is_graded,
            A.graded_date,
            A.time_spent_minutes,
            func.concat(actor.first_name, " ", actor.last_name).label(
                "assigned_by_name"
            ),
            *([A.teacher_feedback] if feedback else []),
        )
    )


def row_dict(row):
    result = dict(row._mapping)
    result["status"] = result["status"].value
    return result


def report_page(
    db,
    *,
    subject_id=None,
    student_id=None,
    term_id=None,
    status=None,
    limit=50,
    cursor=None
):
    query = report_query(db, subject_id, student_id, term_id, status)
    overdue = assignment_status_filter("overdue")
    effective_status = case((overdue, "overdue"), else_=A.status.cast(String))
    graded = and_(
        A.status != "excused",
        A.points_earned.is_not(None),
        or_(A.is_graded, A.status == "graded"),
    )
    summary_row = query.with_entities(
        func.count(A.id).label("total_assignments"),
        func.count(A.id).filter(graded).label("graded_assignments"),
        func.count(A.id).filter(A.status == "submitted").label("pending_assignments"),
        func.count(A.id).filter(overdue).label("overdue_assignments"),
        func.count(A.id).filter(A.status == "excused").label("excused_assignments"),
        func.count(func.distinct(T.subject_id)).label("subjects_count"),
        func.count(func.distinct(A.student_id)).label("students_count"),
    ).one()
    summary = dict(summary_row._mapping)
    weights = crud_settings.get_assignment_type_weights(db)
    scored_groups = (
        query.filter(graded)
        .with_entities(
            func.sum(A.points_earned),
            func.sum(func.coalesce(A.custom_max_points, T.max_points)),
            T.assignment_type,
        )
        .group_by(T.assignment_type)
        .all()
    )
    _, possible, percentage = compute_weighted_grade(scored_groups, weights)
    summary["average_grade"] = round(percentage, 2) if possible > 0 else None
    summary["calculation_note"] = calculation_note(
        weights,
        "selected student, term and report filters; scores pooled across matching work",
    )
    counts = dict(
        query.with_entities(effective_status, func.count(A.id))
        .group_by(effective_status)
        .all()
    )
    by_subject = [
        dict(row._mapping)
        for row in query.join(Subject)
        .with_entities(
            Subject.id,
            Subject.name,
            Subject.color,
            func.count(A.id).label("total"),
            func.count(A.id).filter(A.status == "graded").label("done"),
        )
        .group_by(Subject.id)
        .order_by(Subject.name)
        .all()
    ]
    recent = [
        row_dict(row)
        for row in projection(query.filter(graded, A.graded_date.is_not(None)))
        .order_by(A.graded_date.desc(), A.id.desc())
        .limit(10)
        .all()
    ]
    if cursor:
        query = query.filter(after_date(cursor, A.due_date))
    rows = (
        projection(query)
        .order_by(A.due_date.asc().nullslast(), A.id)
        .limit(limit + 1)
        .all()
    )
    more = len(rows) > limit
    rows = rows[:limit]
    record_rows(len(rows))
    return dict(
        items=[row_dict(row) for row in rows],
        summary=summary,
        counts=counts,
        by_subject=by_subject,
        recently_graded=recent,
        total=summary["total_assignments"],
        next_cursor=(
            encode_cursor(rows[-1].due_date, rows[-1].assignment_id) if more else None
        ),
        **options(db),
    )


def csv_chunks(db, **filters):
    """Server-side cursor bounds memory even for complete-history exports."""
    query = projection(report_query(db, **filters), feedback=True).order_by(A.id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    wrote_header = False
    for row in query.yield_per(500):
        values = row_dict(row)
        if not wrote_header:
            writer.writerow(values.keys())
            wrote_header = True
        # Prevent spreadsheet formula interpretation of free text fields.
        writer.writerow(
            [
                (
                    "'" + v
                    if isinstance(v, str)
                    and v.startswith(("=", "+", "-", "@", "\t", "\r"))
                    else v
                )
                for v in values.values()
            ]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
    if not wrote_header:
        yield "assignment_id,assignment_name\r\n"
