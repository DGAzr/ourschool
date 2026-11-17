"""Set up / snapshot lesson lifecycle cases in the disposable UI review DB."""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.core import database
from app.enums import AssignmentStatus, LessonStatus
from app.models.user import User
from app.models.assignment import (
    AssignmentTemplate,
    StudentAssignment,
    AssignmentTimeEntry,
)
from app.models.lesson import Lesson, LessonTemplate
from app.services.lesson_assignments import sync_lesson_assignments

assert settings.effective_database_url.endswith("/ourschool_ui_review")
database.init_db()
db = database.SessionLocal()
teacher = db.query(User).filter_by(username="review_teacher").one()
students = [
    db.query(User).filter_by(username=name).one()
    for name in ["review_student", "review_younger", "review_teen"]
]
if "--reset" in sys.argv:
    rows = (
        db.query(StudentAssignment)
        .join(AssignmentTemplate)
        .filter(AssignmentTemplate.name.like("Pipeline %"))
        .all()
    )
    for row in rows:
        db.delete(row)
    for lesson in db.query(Lesson).filter(Lesson.title.like("Pipeline review%")).all():
        db.delete(lesson)
    for template, n in zip(
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.name.like("Pipeline %"))
        .order_by(AssignmentTemplate.id)
        .all(),
        [110, 111, 112],
    ):
        template.name = f"Library practice {n:03d}"
    db.commit()
if "--setup" in sys.argv:
    assert not db.query(Lesson).filter(Lesson.title.like("Pipeline review%")).count()
    templates = [
        db.query(AssignmentTemplate).filter_by(name=f"Library practice {n:03d}").one()
        for n in [110, 111, 112]
    ]
    for template, title in zip(
        templates,
        [
            "Pipeline future activity",
            "Pipeline unfinished reflection",
            "Pipeline untouched worksheet",
        ],
    ):
        template.name = title
    future = Lesson(
        title="Pipeline review — future planned lesson",
        date=date(2026, 10, 14),
        status=LessonStatus.PLANNED,
        subject_id=templates[0].subject_id,
        created_by=teacher.id,
        students=[students[0]],
        duration_minutes=25,
    )
    past = Lesson(
        title="Pipeline review — yesterday untaught",
        date=date(2026, 10, 3),
        status=LessonStatus.READY,
        subject_id=templates[1].subject_id,
        created_by=teacher.id,
        students=students,
        duration_minutes=30,
    )
    db.add_all([future, past])
    db.flush()
    db.add_all(
        [
            LessonTemplate(lesson_id=future.id, template_id=templates[0].id),
            LessonTemplate(lesson_id=past.id, template_id=templates[1].id),
            LessonTemplate(lesson_id=past.id, template_id=templates[2].id),
        ]
    )
    db.flush()
    db.expire(future, ["templates"])
    db.expire(past, ["templates"])
    sync_lesson_assignments(db, future, assigned_by=teacher.id)
    sync_lesson_assignments(db, past, assigned_by=teacher.id)
    db.flush()
    rows = (
        db.query(StudentAssignment)
        .filter_by(lesson_id=past.id, template_id=templates[1].id)
        .all()
    )
    for row in rows:
        row.started_date = date(2026, 10, 3)
        if row.student_id == students[0].id:
            row.status = AssignmentStatus.IN_PROGRESS
            row.student_notes = "I have already worked on this reflection."
            row.time_spent_minutes = 25
            db.add(
                AssignmentTimeEntry(
                    assignment_id=row.id,
                    logged_by=row.student_id,
                    work_date=date(2026, 10, 3),
                    minutes=25,
                    note="Meaningful work before lesson was marked taught",
                )
            )
        else:
            row.status = AssignmentStatus.SUBMITTED
            row.submitted_date = date(2026, 10, 3)
            row.completed_date = date(2026, 10, 3)
            row.submission_notes = (
                "Completed independently before teacher marked lesson taught."
            )
            if row.student_id == students[2].id:
                row.status = AssignmentStatus.GRADED
                row.is_graded = True
                row.points_earned = 18
                row.percentage_grade = 90
                row.graded_date = date(2026, 10, 3)
                row.graded_by = teacher.id
    db.commit()
if "--mark-untaught" in sys.argv:
    lesson = (
        db.query(Lesson).filter_by(title="Pipeline review — yesterday untaught").one()
    )
    lesson.status = LessonStatus.READY
    db.commit()
lessons = (
    db.query(Lesson)
    .filter(Lesson.title.like("Pipeline review%"))
    .order_by(Lesson.id)
    .all()
)
templates = (
    db.query(AssignmentTemplate)
    .filter(AssignmentTemplate.name.like("Pipeline %"))
    .all()
)
rows = (
    db.query(StudentAssignment)
    .filter(StudentAssignment.template_id.in_([t.id for t in templates]))
    .order_by(StudentAssignment.id)
    .all()
)
print(
    json.dumps(
        {
            "lessons": [
                {
                    "id": l.id,
                    "title": l.title,
                    "date": str(l.date) if l.date else None,
                    "status": l.status.value,
                }
                for l in lessons
            ],
            "assignments": [
                {
                    "id": r.id,
                    "template": r.template.name,
                    "student": r.student.username,
                    "lesson_id": r.lesson_id,
                    "assigned_date": str(r.assigned_date),
                    "due_date": str(r.due_date),
                    "status": r.status.value,
                    "started_date": str(r.started_date) if r.started_date else None,
                    "submitted_date": (
                        str(r.submitted_date) if r.submitted_date else None
                    ),
                    "is_graded": r.is_graded,
                    "points_earned": r.points_earned,
                    "student_notes": r.student_notes,
                    "time_spent_minutes": r.time_spent_minutes,
                    "time_entries": [
                        {"id": t.id, "minutes": t.minutes, "note": t.note}
                        for t in r.time_entries
                    ],
                }
                for r in rows
            ],
        },
        indent=2,
    )
)
