"""Bounded teacher dashboard projections; queue predicates match their lists."""

from datetime import timedelta, datetime, timezone
from sqlalchemy import func
from app.crud.assignment_reads import assignment_base, tab_predicates, A
from app.crud.points import is_points_system_enabled
from app.models.user import User, UserRole
from app.models.lesson import Lesson, LessonMaterial, lesson_students
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry
from app.models.shop import ShopRedemption
from app.models.assignment import AssignmentHelpRequest, AssignmentTemplate
from app.enums import LessonStatus


def roster(db, student_id=None):
    query = db.query(User.id, User.first_name, User.last_name).filter(
        User.role == UserRole.STUDENT, User.is_active.is_(True)
    )
    return query.filter(User.id == student_id) if student_id else query


def scope_dates(today, scope):
    start = today - timedelta(days=today.weekday()) if scope == "week" else today
    return start, start + timedelta(days=6) if scope == "week" else today


def work_scope(query, due_to=None):
    due = func.coalesce(A.extended_due_date, A.due_date)
    return query.filter((due <= due_to) | due.is_(None)) if due_to else query


def lessons_scope(db, student_id=None):
    query = db.query(
        Lesson.id, Lesson.title, Lesson.date, Lesson.status, Lesson.position
    )
    active_ids = roster(db).with_entities(User.id)
    query = query.filter(
        ~Lesson.students.any() | Lesson.students.any(User.id.in_(active_ids))
    )
    return (
        query.filter(
            Lesson.students.any(
                (User.id == student_id)
                & User.is_active.is_(True)
                & (User.role == UserRole.STUDENT)
            )
        )
        if student_id
        else query
    )


def lesson_page(db, query, offset, limit):
    total = query.count()
    offset = min(offset, max(0, (total - 1) // limit * limit))
    taught = query.filter(Lesson.status == LessonStatus.TAUGHT).count()
    remaining = (
        db.query(func.count(LessonMaterial.id))
        .filter(
            LessonMaterial.lesson_id.in_(
                query.filter(Lesson.status != LessonStatus.TAUGHT).with_entities(
                    Lesson.id
                )
            ),
            LessonMaterial.is_gathered.is_(False),
        )
        .scalar()
    )
    rows = (
        query.order_by(Lesson.date, Lesson.position, Lesson.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    page_ids = [row.id for row in rows]
    materials = (
        db.query(
            LessonMaterial.id,
            LessonMaterial.lesson_id,
            LessonMaterial.label,
            LessonMaterial.is_gathered,
        )
        .filter(LessonMaterial.lesson_id.in_(page_ids))
        .order_by(LessonMaterial.position, LessonMaterial.id)
        .all()
        if page_ids
        else []
    )
    people = (
        db.query(lesson_students.c.lesson_id, User.id, User.first_name, User.last_name)
        .join(User, User.id == lesson_students.c.student_id)
        .filter(
            lesson_students.c.lesson_id.in_(page_ids),
            User.is_active.is_(True),
            User.role == UserRole.STUDENT,
        )
        .all()
        if page_ids
        else []
    )
    return dict(
        items=[
            dict(
                row._mapping,
                materials=[
                    dict(m._mapping) for m in materials if m.lesson_id == row.id
                ],
                students=[dict(p._mapping) for p in people if p.lesson_id == row.id],
            )
            for row in rows
        ],
        total=total,
        taught=taught,
        materials_remaining=remaining,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


def schedule(db, today, scope, student_id, offset, limit, preparation=False):
    query = lessons_scope(db, student_id)
    start, end = scope_dates(today, scope)
    next_date = None
    if preparation:
        next_date = (
            query.filter(Lesson.date > today, Lesson.status != LessonStatus.TAUGHT)
            .with_entities(func.min(Lesson.date))
            .scalar()
        )
        query = (
            query.filter(Lesson.date == next_date) if next_date else query.filter(False)
        )
    else:
        query = query.filter(Lesson.date >= start, Lesson.date <= end)
    page = lesson_page(db, query, offset, limit)
    if preparation:
        return dict(page, date=next_date)
    active = roster(db, student_id)
    records = (
        db.query(AttendanceRecord.student_id, AttendanceRecord.status)
        .filter(
            AttendanceRecord.date == today,
            AttendanceRecord.student_id.in_(active.with_entities(User.id)),
        )
        .all()
    )
    today_query = lessons_scope(db, student_id).filter(Lesson.date == today)
    return dict(
        page,
        start_date=start,
        end_date=end,
        attendance=dict(
            total=active.count(),
            recorded=len(records),
            records=[dict(r._mapping) for r in records],
        ),
        today_planned=today_query.filter(Lesson.status != LessonStatus.TAUGHT).count(),
    )


def inbox_queries(db, student_id=None):
    common = (User.role == UserRole.STUDENT, User.is_active.is_(True))
    student_name = func.concat(User.first_name, " ", User.last_name).label(
        "student_name"
    )
    journal = (
        db.query(
            JournalEntry.id,
            JournalEntry.student_id,
            student_name,
            JournalEntry.title,
            func.substr(JournalEntry.content, 1, 240).label("preview"),
            JournalEntry.entry_date,
            JournalEntry.created_at,
        )
        .join(User, User.id == JournalEntry.student_id)
        .filter(*common, JournalEntry.needs_response.is_(True))
    )
    reward = (
        db.query(
            ShopRedemption.id,
            ShopRedemption.student_id,
            student_name,
            ShopRedemption.item_name.label("title"),
            ShopRedemption.cost_points,
            ShopRedemption.pickup_instructions,
            ShopRedemption.created_at,
        )
        .join(User, User.id == ShopRedemption.student_id)
        .filter(*common)
    )
    help_query = (
        db.query(
            AssignmentHelpRequest.id,
            A.student_id,
            student_name,
            AssignmentTemplate.name.label("title"),
            AssignmentHelpRequest.note.label("preview"),
            AssignmentHelpRequest.assignment_id,
            AssignmentHelpRequest.created_at,
        )
        .join(A, A.id == AssignmentHelpRequest.assignment_id)
        .join(User, User.id == A.student_id)
        .join(AssignmentTemplate, AssignmentTemplate.id == A.template_id)
        .filter(*common, AssignmentHelpRequest.resolved_at.is_(None))
    )
    queries = dict(journals=journal, help=help_query)
    if is_points_system_enabled(db):
        queries.update(
            approvals=reward.filter(ShopRedemption.status == "pending"),
            pickups=reward.filter(ShopRedemption.status == "ready"),
        )
    if student_id:
        queries = {
            key: query.filter(User.id == student_id) for key, query in queries.items()
        }
    return queries


def inbox(db, student_id, category, offset, limit):
    queries = inbox_queries(db, student_id)
    if category != "all" and category in queries:
        total = queries[category].count()
        offset = min(offset, max(0, (total - 1) // limit * limit))
    groups = {}
    for key, query in queries.items():
        total = query.count()
        items = []
        if category == "all" or category == key:
            model = {
                "journals": JournalEntry,
                "help": AssignmentHelpRequest,
                "approvals": ShopRedemption,
                "pickups": ShopRedemption,
            }[key]
            items = [
                dict(row._mapping)
                for row in query.order_by(model.created_at, model.id)
                .offset(0 if category == "all" else offset)
                .limit(3 if category == "all" else limit)
                .all()
            ]
        groups[key] = dict(
            items=items,
            total=total,
            has_more=(0 if category == "all" else offset) + len(items) < total,
        )
    return dict(groups=groups, offset=offset)


def student_overview(db, today, scope, student_id, all_work, offset, limit):
    active = roster(db, student_id)
    total = active.count()
    offset = min(offset, max(0, (total - 1) // limit * limit))
    rows = (
        active.order_by(User.first_name, User.last_name, User.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    ids = [row.id for row in rows]
    start, end = scope_dates(today, scope)
    predicates = tab_predicates(today)
    work = work_scope(
        assignment_base(db, active_students=True), None if all_work else end
    ).filter(A.student_id.in_(ids))
    work_counts = {
        row.student_id: dict(row._mapping)
        for row in work.with_entities(
            A.student_id,
            *(
                func.count(A.id).filter(predicates[key]).label(key)
                for key in ("review", "needs", "awaiting", "overdue")
            ),
        )
        .group_by(A.student_id)
        .all()
    }
    lessons = (
        db.query(
            lesson_students.c.student_id,
            func.count(Lesson.id).label("lessons"),
            func.count(Lesson.id)
            .filter(Lesson.status == LessonStatus.TAUGHT)
            .label("taught"),
        )
        .join(Lesson, Lesson.id == lesson_students.c.lesson_id)
        .filter(
            lesson_students.c.student_id.in_(ids),
            Lesson.date >= start,
            Lesson.date <= end,
        )
        .group_by(lesson_students.c.student_id)
        .all()
    )
    lesson_counts = {row.student_id: dict(row._mapping) for row in lessons}
    attendance = {
        row.student_id: row.status
        for row in db.query(AttendanceRecord.student_id, AttendanceRecord.status)
        .filter(AttendanceRecord.student_id.in_(ids), AttendanceRecord.date == today)
        .all()
    }
    queue_counts = {
        key: {
            row.student_id: row.total
            for row in query.filter(User.id.in_(ids))
            .with_entities(User.id.label("student_id"), func.count().label("total"))
            .group_by(User.id)
            .all()
        }
        for key, query in inbox_queries(db).items()
    }
    return dict(
        items=[
            dict(
                row._mapping,
                attendance=attendance.get(row.id),
                work=work_counts.get(row.id, {}),
                schedule=lesson_counts.get(row.id, {}),
                inbox={
                    key: counts.get(row.id, 0) for key, counts in queue_counts.items()
                },
            )
            for row in rows
        ],
        total=total,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


def recent_activity(db, student_id, limit):
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    base = assignment_base(db, active_students=True)
    if student_id:
        base = base.filter(A.student_id == student_id)
    activities = []
    for column, kind, verb in (
        (A.submitted_date, "assignment_submitted", "Submitted"),
        (A.graded_date, "assignment_graded", "Graded"),
    ):
        rows = (
            base.with_entities(
                A.id,
                A.student_id,
                AssignmentTemplate.name,
                User.first_name,
                User.last_name,
                column.label("timestamp"),
            )
            .filter(column >= start, column <= now)
            .order_by(column.desc(), A.id.desc())
            .limit(limit)
            .all()
        )
        for row in rows:
            activities.append(
                dict(
                    activity_type=kind,
                    description=f"{verb}: {row.name}",
                    timestamp=row.timestamp,
                    student_name=f"{row.first_name} {row.last_name}",
                    details=dict(assignment_id=row.id, student_id=row.student_id),
                    time_ago=row.timestamp.strftime("%b %d, %H:%M"),
                )
            )
    records = (
        db.query(
            AttendanceRecord.id,
            AttendanceRecord.student_id,
            AttendanceRecord.date,
            AttendanceRecord.status,
            AttendanceRecord.updated_at,
            User.first_name,
            User.last_name,
        )
        .join(User, User.id == AttendanceRecord.student_id)
        .filter(
            User.id.in_(roster(db, student_id).with_entities(User.id)),
            AttendanceRecord.updated_at >= start,
            AttendanceRecord.updated_at <= now,
        )
        .order_by(AttendanceRecord.updated_at.desc(), AttendanceRecord.id.desc())
        .limit(limit)
        .all()
    )
    for row in records:
        activities.append(
            dict(
                activity_type="attendance_recorded",
                description=f"Attendance: {row.status.value}",
                timestamp=row.updated_at,
                student_name=f"{row.first_name} {row.last_name}",
                details=dict(
                    attendance_id=row.id, student_id=row.student_id, date=row.date
                ),
                time_ago=row.updated_at.strftime("%b %d, %H:%M"),
            )
        )
    return dict(
        activities=sorted(activities, key=lambda item: item["timestamp"], reverse=True)[
            :limit
        ]
    )
