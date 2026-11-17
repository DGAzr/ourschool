"""Read-only student plan, using existing records and explicit student scoping."""

from sqlalchemy import func, or_, and_, not_
from sqlalchemy.orm import lazyload

from app.crud.assignment_reads import tab_predicates
from app.models.assignment import (
    StudentAssignment,
    AssignmentTemplate,
    AssignmentHelpRequest,
)
from app.models.lesson import Lesson
from app.models.user import User
from app.schemas.lesson import StudentActivityResponse, StudentLessonDetailResponse


def activity_query(db, student_id):
    """Project only navigation fields; never hydrate work history or materials."""
    return (
        db.query(
            StudentAssignment.id,
            StudentAssignment.lesson_id,
            StudentAssignment.template_id,
            StudentAssignment.student_id,
            StudentAssignment.status,
            StudentAssignment.started_date,
            StudentAssignment.submitted_date,
            StudentAssignment.is_graded,
            StudentAssignment.time_spent_minutes,
            StudentAssignment.due_date,
            StudentAssignment.extended_due_date,
            AssignmentTemplate.name,
            AssignmentTemplate.estimated_duration_minutes,
            db.query(AssignmentHelpRequest.id)
            .filter(
                AssignmentHelpRequest.assignment_id == StudentAssignment.id,
                AssignmentHelpRequest.resolved_at.is_(None),
            )
            .exists()
            .label("help_requested"),
        )
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .filter(StudentAssignment.student_id == student_id)
    )


def accessible_lessons(db, student_id):
    own_work = db.query(StudentAssignment.lesson_id).filter(
        StudentAssignment.student_id == student_id
    )
    return (
        db.query(Lesson)
        .options(
            lazyload(Lesson.students),
            lazyload(Lesson.materials),
            lazyload(Lesson.creator),
        )
        .filter(
            or_(Lesson.students.any(User.id == student_id), Lesson.id.in_(own_work))
        )
    )


def project_lessons(db, student_id, lessons):
    by_lesson = {}
    if lessons:
        for row in (
            activity_query(db, student_id)
            .filter(StudentAssignment.lesson_id.in_([lesson.id for lesson in lessons]))
            .order_by(StudentAssignment.id)
        ):
            by_lesson.setdefault(row.lesson_id, []).append(
                StudentActivityResponse.model_validate(row)
            )
    return [
        StudentLessonDetailResponse.model_validate(lesson).model_copy(
            update={"assignments": by_lesson.get(lesson.id, [])}
        )
        for lesson in lessons
    ]


def student_day(db, student_id, school_date):
    lessons = (
        accessible_lessons(db, student_id)
        .filter(Lesson.date == school_date)
        .order_by(Lesson.position, Lesson.id)
        .all()
    )
    due = func.coalesce(StudentAssignment.extended_due_date, StudentAssignment.due_date)
    # A scheduled lesson supplies the work day. For unscheduled work, the
    # deadline (or assigned day when undated) supplies today's explicit list.
    standalone = and_(
        Lesson.date.is_(None),
        or_(
            due == school_date,
            and_(due.is_(None), StudentAssignment.assigned_date == school_date),
        ),
    )
    query = activity_query(db, student_id).outerjoin(
        Lesson, StudentAssignment.lesson_id == Lesson.id
    )
    earlier = or_(
        Lesson.date < school_date,
        and_(Lesson.date.is_(None), due < school_date),
    )
    open_work = query.filter(tab_predicates(school_date)["todo"])

    def section(predicate):
        selected = open_work.filter(predicate)
        return dict(
            total=selected.count(),
            items=selected.order_by(
                StudentAssignment.started_date.is_(None),
                due.asc().nullslast(),
                StudentAssignment.id,
            )
            .limit(6)
            .all(),
        )

    # Explicit NULL handling matters: SQL NOT(NULL) would drop unlinked work.
    outside_day = and_(
        or_(Lesson.date.is_(None), Lesson.date != school_date),
        not_(func.coalesce(standalone, False)),
    )
    return dict(
        date=school_date,
        lessons=project_lessons(db, student_id, lessons),
        standalone=query.filter(standalone).order_by(StudentAssignment.id).all(),
        earlier=section(and_(outside_day, earlier)),
        other=section(and_(outside_day, not_(func.coalesce(earlier, False)))),
    )
