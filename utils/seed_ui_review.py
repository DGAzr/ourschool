"""Synthetic UI review fixtures. Only runs against the named disposable database.

Run inside the isolated review API container: python utils/seed_ui_review.py
Review-only login password: UiReview-2026! (all five synthetic accounts).
"""

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.core import database
from app.core.security import get_password_hash
from app.enums import (
    UserRole,
    TermType,
    AssignmentStatus,
    AttendanceStatus,
    LessonStatus,
)
from app.models.user import User
from app.models.subject import Subject
from app.models.term import Term, TermSubject
from app.models.assignment import (
    AssignmentTemplate,
    StudentAssignment,
    AssignmentTimeEntry,
)
from app.models.lesson import Lesson, LessonMaterial, LessonResource, LessonTemplate
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry, JournalReply
from app.models.points import SystemSettings, StudentPoints, PointTransaction
from app.models.shop import ShopCategory, ShopItem, ShopRedemption
from app.models.paperless import (
    PaperlessLibrary,
    PaperlessDocument,
    TemplatePaperlessMaterial,
)
from app.models.assignment_type import AssignmentTypeConfig

assert settings.effective_database_url.endswith(
    "/ourschool_ui_review"
), "Refusing non-review database"
database.init_db()
db = database.SessionLocal()
assert db.query(User).count() == 0, "Fixtures require an empty review database"
today = date(2026, 10, 4)
now = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
password = get_password_hash("UiReview-2026!")
teacher = User(
    username="review_teacher",
    email="teacher@example.invalid",
    first_name="Morgan",
    last_name="Review",
    role=UserRole.ADMIN,
    hashed_password=password,
    theme_preference="light",
)
db.add(teacher)
db.flush()
students = []
for username, first, grade in [
    ("review_student", "Alex", 5),
    ("review_younger", "Sam", 0),
    ("review_teen", "Jordan", 10),
    ("review_empty", "Taylor", 3),
]:
    student = User(
        username=username,
        email=f"{username}@example.invalid",
        first_name=first,
        last_name="Review",
        role=UserRole.STUDENT,
        grade_level=grade,
        parent_id=teacher.id,
        hashed_password=password,
        theme_preference="light",
    )
    db.add(student)
    students.append(student)
subjects = [
    Subject(name=name, color=color, description=f"{name} homeschool learning")
    for name, color in [
        ("Mathematics", "#2563eb"),
        ("Language Arts", "#9333ea"),
        ("Science", "#059669"),
        ("History", "#d97706"),
        ("Art", "#dc2626"),
        ("Physical Education", "#0891b2"),
    ]
]
db.add_all(subjects)
db.flush()
terms = [
    Term(
        name="Fall 2026",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 12, 18),
        academic_year="2026-2027",
        term_type=TermType.SEMESTER,
        is_active=True,
        created_by=teacher.id,
    ),
    Term(
        name="Spring 2026",
        start_date=date(2026, 1, 5),
        end_date=date(2026, 5, 29),
        academic_year="2025-2026",
        term_type=TermType.SEMESTER,
        is_active=False,
        created_by=teacher.id,
    ),
]
db.add_all(terms)
db.flush()
for term in terms:
    for subject in subjects:
        db.add(
            TermSubject(
                term_id=term.id,
                subject_id=subject.id,
                learning_goals="Build confidence through practice and projects",
            )
        )
if not db.query(AssignmentTypeConfig).count():
    for i, key in enumerate(
        [
            "homework",
            "project",
            "test",
            "quiz",
            "essay",
            "presentation",
            "worksheet",
            "reading",
            "practice",
        ]
    ):
        db.add(AssignmentTypeConfig(key=key, name=key.title(), display_order=i))
titles = [
    "Fraction practice — mixed numbers",
    "Read chapter 3 and explain the main idea",
    "Build a water-cycle model",
    "Local history interview",
    "Sketch autumn leaves",
    "Nature walk and movement log",
    "Long project: compare renewable energy sources and present your findings to the family",
    "Weekly spelling quiz",
    "Independent reading reflection",
]
templates = []
for i in range(125):
    template = AssignmentTemplate(
        name=titles[i] if i < len(titles) else f"Library practice {i:03d}",
        subject_id=subjects[i % 6].id,
        assignment_type=[
            "worksheet",
            "reading",
            "project",
            "essay",
            "practice",
            "quiz",
        ][i % 6],
        max_points=20 if i % 3 == 0 else 100,
        instructions="## Your task\n1. Gather your materials.\n2. Work through the activity at your own pace.\n3. Explain what you learned.\n\nAsk your teacher if you get stuck.",
        description="Practice independently, then discuss your work together.",
        estimated_duration_minutes=15 + i % 4 * 10,
        materials_needed="Pencil, notebook, colored pencils",
        prerequisites="Review the previous lesson",
        created_by=teacher.id,
        is_archived=i in [120, 121],
    )
    db.add(template)
    templates.append(template)
db.flush()
assignments = []
statuses = list(AssignmentStatus)
for si, student in enumerate(students[:3]):
    for i in range(28):
        status = statuses[i % 6]
        due = today + timedelta(days=(i % 9) - 4)
        if status == AssignmentStatus.OVERDUE:
            due = today - timedelta(days=2)
        assignment = StudentAssignment(
            template_id=templates[i].id,
            student_id=student.id,
            assigned_by=teacher.id,
            assigned_date=today - timedelta(days=14),
            due_date=due,
            status=status,
            is_graded=status == AssignmentStatus.GRADED,
            time_spent_minutes=(
                25
                if status in [AssignmentStatus.IN_PROGRESS, AssignmentStatus.GRADED]
                else 0
            ),
            extended_due_date=today + timedelta(days=3) if i == 4 else None,
        )
        if status == AssignmentStatus.GRADED:
            assignment.points_earned = templates[i].max_points * (
                [0.92, 0.78, 0.63][si]
            )
            assignment.percentage_grade = [92, 78, 63][si]
            assignment.letter_grade = ["A", "C", "D"][si]
            assignment.graded_by = teacher.id
            assignment.graded_date = today - timedelta(days=2)
            assignment.teacher_feedback = "Good explanation. Next time include a labeled diagram and check your units."
        if status in [AssignmentStatus.GRADED, AssignmentStatus.SUBMITTED]:
            assignment.started_date = today - timedelta(days=6)
            assignment.submitted_date = today - timedelta(days=3)
            assignment.completed_date = assignment.submitted_date
            assignment.submission_notes = (
                "I finished the activity and would like feedback on my diagram."
            )
            assignment.submission_artifacts = json.dumps(["https://example.org"])
        db.add(assignment)
        assignments.append(assignment)
    for i in range(25):
        day = today - timedelta(days=i + 1)
        if day.weekday() < 5:
            db.add(
                AttendanceRecord(
                    student_id=student.id,
                    date=day,
                    status=(
                        list(AttendanceStatus)[i % 4]
                        if i % 7 == 0
                        else AttendanceStatus.PRESENT
                    ),
                    notes="Family field trip" if i == 7 else None,
                )
            )
    for i in range(5):
        entry = JournalEntry(
            student_id=student.id,
            author_id=student.id if i % 2 == 0 else teacher.id,
            title=[
                "I finally understood fractions",
                "Today was challenging",
                "Our field trip",
                "A small win",
                "Next week goals",
            ][i],
            content="I practiced patiently and tried a new strategy.\n\nI would like help with the final question.",
            entry_date=now - timedelta(days=i),
            mood=["great", "okay", "hard"][i % 3],
            tags=["reflection", "science"] if i % 2 == 0 else ["practice"],
            win="I explained my thinking clearly.",
            goals=[{"text": "Practice for ten minutes", "completed": False}],
            needs_response=i % 2 == 0,
            reactions=["Proud of you"] if i == 3 else [],
        )
        db.add(entry)
        db.flush()
        if i == 1:
            db.add(
                JournalReply(
                    entry_id=entry.id,
                    author_id=teacher.id,
                    text="We can work through this together tomorrow.",
                )
            )
db.flush()
for assignment in assignments:
    if assignment.time_spent_minutes:
        db.add(
            AssignmentTimeEntry(
                assignment_id=assignment.id,
                logged_by=assignment.student_id,
                work_date=today - timedelta(days=1),
                minutes=25,
                note="Worked on paper",
            )
        )
for i in range(12):
    lesson = Lesson(
        title=[
            "Explore equivalent fractions",
            "Water cycle experiment",
            "Read aloud and discuss",
            "Nature sketching",
        ][i % 4],
        date=None if i > 8 else today + timedelta(days=i // 3),
        last_scheduled_date=today - timedelta(days=2) if i > 8 else None,
        objective="Explain what you learned using words, a drawing, or a model.",
        duration_minutes=25 + i % 3 * 10,
        notes="Teacher preparation: adapt questions for each age.\n\nAsk the student to explain their strategy.",
        position=i % 3,
        status=list(LessonStatus)[i % 3],
        subject_id=subjects[i % 6].id,
        created_by=teacher.id,
        students=students[:2],
    )
    db.add(lesson)
    db.flush()
    db.add_all(
        [
            LessonMaterial(
                lesson_id=lesson.id,
                label="Notebook and pencil",
                is_gathered=True,
                position=0,
            ),
            LessonMaterial(
                lesson_id=lesson.id,
                label="Print the activity sheet",
                is_gathered=False,
                position=1,
            ),
            LessonResource(
                lesson_id=lesson.id,
                label="Reference example",
                url="https://example.org",
                position=0,
            ),
            LessonTemplate(lesson_id=lesson.id, template_id=templates[i].id),
        ]
    )
    if i < 9:
        for si in range(2):
            assignments[si * 28 + i].lesson_id = lesson.id
for key, value, kind in [
    ("points_system_enabled", "true", "boolean"),
    ("required_school_days", "180", "integer"),
]:
    setting = db.query(SystemSettings).filter_by(setting_key=key).first()
    if setting:
        setting.setting_value = value
    else:
        db.add(SystemSettings(setting_key=key, setting_value=value, setting_type=kind))
category = ShopCategory(name="Family rewards", icon="🎉", color="#9333ea")
db.add(category)
db.flush()
items = []
for i, (name, cost, stock, fulfillment) in enumerate(
    [
        ("Choose the read-aloud", 50, None, "instant"),
        ("Extra art time", 150, 3, "request"),
        ("Museum adventure", 500, 2, "request"),
        ("Mystery craft kit", 200, 0, "request"),
    ]
):
    item = ShopItem(
        name=name,
        category_id=category.id,
        cost_points=cost,
        quantity_available=stock,
        fulfillment_type=fulfillment,
        description="A reward to enjoy together. Arrange the time with your teacher.",
        display_order=i,
    )
    db.add(item)
    items.append(item)
db.flush()
for si, student in enumerate(students):
    balance = [175, 20, 650, 0][si]
    db.add(
        StudentPoints(
            student_id=student.id,
            current_balance=balance,
            total_earned=balance,
            goal_item_id=items[2].id if si == 0 else None,
        )
    )
    if balance:
        db.add(
            PointTransaction(
                student_id=student.id,
                amount=balance,
                transaction_type="admin_award",
                source_description="Synthetic review opening balance",
                admin_id=teacher.id,
            )
        )
for i, (status, item_index) in enumerate(
    [("pending", 1), ("ready", 1), ("fulfilled", 1), ("declined", 2), ("redeemed", 0)]
):
    item = items[item_index]
    db.add(
        ShopRedemption(
            student_id=students[0].id,
            item_id=item.id,
            item_name=item.name,
            cost_points=item.cost_points,
            fulfillment_type=item.fulfillment_type,
            status=status,
            created_at=now - timedelta(days=i + 1),
        )
    )
library = PaperlessLibrary(url="http://review-paperless.invalid")
db.add(library)
db.flush()
for i in range(18):
    doc = PaperlessDocument(
        library_id=library.id,
        paperless_id=i + 1,
        title=f"Synthetic {subjects[i%6].name} worksheet {i+1}",
        subject_id=subjects[i % 6].id,
        material_kind=["worksheet", "reading", "reference"][i % 3],
        page_count=2,
        paperless_added=now - timedelta(days=i),
        keywords="fractions water cycle science reading",
    )
    db.add(doc)
    db.flush()
    if i == 0:
        db.add(
            TemplatePaperlessMaterial(
                template_id=templates[0].id,
                document_id=doc.id,
                title=doc.title,
                material_kind=doc.material_kind,
                page_count=2,
                subject_id=doc.subject_id,
            )
        )
db.commit()
print(
    json.dumps(
        {
            "students": len(students),
            "templates": len(templates),
            "assignments": len(assignments),
            "lessons": 12,
            "journals": 15,
            "materials": 18,
            "shop_items": 4,
            "date": today.isoformat(),
        },
        indent=2,
    )
)
