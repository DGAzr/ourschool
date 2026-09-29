"""Bounded assignment projections and shared aggregate queries.

No ORM entities are hydrated by list queries, so default eager relationships
cannot turn a small page or an aggregate into a history/material download.
"""

import base64
import json
from datetime import date

from fastapi import HTTPException
from sqlalchemy import func, or_, and_

from app.models.assignment import AssignmentTemplate as T, StudentAssignment as A
from app.models.user import User, UserRole
from app.enums import AssignmentStatus as Status

TEMPLATE_FIELDS = (
    "id",
    "name",
    "assignment_type",
    "subject_id",
    "icon",
    "max_points",
    "estimated_duration_minutes",
    "is_exportable",
    "is_library",
    "is_archived",
    "created_by",
    "created_at",
    "updated_at",
)
ASSIGNMENT_FIELDS = (
    "id",
    "template_id",
    "student_id",
    "lesson_id",
    "assigned_date",
    "due_date",
    "extended_due_date",
    "status",
    "started_date",
    "completed_date",
    "submitted_date",
    "points_earned",
    "percentage_grade",
    "letter_grade",
    "is_graded",
    "graded_date",
    "graded_by",
    "time_spent_minutes",
    "is_student_created",
    "custom_max_points",
    "assigned_by",
    "created_at",
    "updated_at",
)


def encode_cursor(*values):
    return base64.urlsafe_b64encode(json.dumps(values, default=str).encode()).decode()


def decode_cursor(cursor):
    try:
        values = json.loads(base64.b64decode(cursor, altchars=b"-_", validate=True))
        if (
            not isinstance(values, list)
            or len(values) != 2
            or not isinstance(values[0], (str, type(None)))
            or type(values[1]) is not int
            or values[1] < 1
        ):
            raise ValueError()
        return values
    except (ValueError, TypeError, UnicodeError):
        raise HTTPException(422, "Invalid page cursor")


def after_date(cursor, column, id_column=A.id):
    """Ascending date, NULLS LAST, then ascending unique id."""
    value, row_id = decode_cursor(cursor)
    if value is None:
        return column.is_(None) & (id_column > row_id)
    try:
        value = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, "Invalid page cursor")
    return or_(
        column > value, column.is_(None), (column == value) & (id_column > row_id)
    )


def template_stats(db, ids):
    if not ids:
        return {}
    rows = (
        db.query(
            A.template_id,
            func.count(A.id),
            func.count(A.id).filter(
                A.status.in_(
                    [
                        Status.NOT_STARTED,
                        Status.IN_PROGRESS,
                        Status.OVERDUE,
                        Status.SUBMITTED,
                    ]
                )
            ),
            func.avg(A.percentage_grade).filter(A.is_graded),
        )
        .filter(A.template_id.in_(ids))
        .group_by(A.template_id)
        .all()
    )
    return {
        r[0]: dict(total_assigned=r[1], active_assigned=r[2], average_grade=r[3])
        for r in rows
    }


def template_projection(db):
    return db.query(
        *(getattr(T, field) for field in TEMPLATE_FIELDS),
        func.substr(T.description, 1, 240).label("description"),
    )


def assignment_projection(query):
    return query.with_entities(
        *(getattr(A, field) for field in ASSIGNMENT_FIELDS),
        *(getattr(T, field).label("template_" + field) for field in TEMPLATE_FIELDS),
        func.substr(T.description, 1, 240).label("description"),
    )


def assignment_summary(row):
    values = row._mapping
    return dict(
        **{field: values[field] for field in ASSIGNMENT_FIELDS},
        template=dict(
            **{field: values["template_" + field] for field in TEMPLATE_FIELDS},
            description=values["description"],
            is_summary=True,
        ),
        is_summary=True,
    )


def assignment_base(db):
    return (
        db.query(A)
        .join(T, A.template_id == T.id)
        .join(User, A.student_id == User.id)
        .filter(User.role == UserRole.STUDENT)
    )


def tab_predicates():
    graded = or_(A.is_graded.is_(True), A.status == Status.GRADED)
    done = or_(graded, A.status == Status.EXCUSED)
    submitted = A.status == Status.SUBMITTED
    unfinished = A.status.in_([Status.NOT_STARTED, Status.IN_PROGRESS, Status.OVERDUE])
    overdue = unfinished & (
        func.coalesce(A.extended_due_date, A.due_date) < date.today()
    )
    awaiting = A.status.in_([Status.NOT_STARTED, Status.IN_PROGRESS])
    return {
        "all": A.id.is_not(None),
        "open": or_(awaiting, overdue & ~graded),
        "to_grade": submitted & A.is_graded.is_(False),
        "graded": graded,
        "excused": A.status == Status.EXCUSED,
        "todo": ~done & ~submitted,
        "submitted": ~done & submitted,
        "done": done,
        "needs": submitted & A.is_graded.is_(False),
        "overdue": overdue & ~graded,
        "awaiting": unfinished & ~graded,
        "awaiting_submission": awaiting,
        "queue_all": A.status != Status.EXCUSED,
    }


def scoped_filters(
    query,
    *,
    subject_id=None,
    student_id=None,
    template_id=None,
    search=None,
    assignment_type=None
):
    if subject_id is not None:
        query = query.filter(T.subject_id == subject_id)
    if student_id is not None:
        query = query.filter(A.student_id == student_id)
    if template_id is not None:
        query = query.filter(A.template_id == template_id)
    if assignment_type:
        query = query.filter(T.assignment_type == assignment_type)
    if search:
        # Escape SQL wildcards: search input is a literal substring.
        pattern = (
            "%"
            + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            + "%"
        )
        query = query.filter(
            or_(
                T.name.ilike(pattern, escape="\\"),
                T.description.ilike(pattern, escape="\\"),
                func.concat(User.first_name, " ", User.last_name).ilike(
                    pattern, escape="\\"
                ),
            )
        )
    return query


def term_filter(term, basis):
    anchor = {
        "assigned": A.assigned_date,
        "original_due": func.coalesce(A.due_date, A.assigned_date),
        "effective": func.coalesce(A.extended_due_date, A.due_date, A.assigned_date),
    }[basis]
    return and_(anchor >= term.start_date, anchor <= term.end_date)
