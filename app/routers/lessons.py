# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""Lesson planning endpoints.

Admin-only (parent/teacher) planning surface. Editor saves go through the
full-replace PUT; Teach-mode interactions use the tiny PATCH endpoints. Every
create/update/delete runs the assignment sync service so linked templates keep
StudentAssignments in step with the lesson.
"""

import logging
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    get_user_id_from_auth,
    require_admin_or_permission,
    require_student_session,
)
from app.enums import LessonStatus
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.lesson import Lesson, LessonMaterial, LessonResource, LessonTemplate
from app.models.paperless import LessonPaperlessMaterial
from app.models.user import User
from app.schemas.lesson import (
    LessonAssignmentProgress,
    LessonImpactInput,
    LessonBatchInput,
    AssignmentImpact,
    LessonCreate,
    LessonDeleteResponse,
    LessonMaterialToggle,
    LessonReorderInput,
    LessonReorderResponse,
    LessonResponse,
    LessonRolloverInput,
    LessonRolloverResponse,
    LessonStatusUpdate,
    LessonTemplateLinkInput,
    LessonUpdate,
    LessonWriteResponse,
    StudentLessonResponse,
)
from app.routers.validators import validate_students
from app.services.lesson_assignments import sync_lesson_assignments, assignment_impact

logger = logging.getLogger(__name__)
router = APIRouter()


def _same_container_filter(value):
    """SQL predicate for a scheduled day or the NULL-date drawer."""
    return Lesson.date.is_(None) if value is None else Lesson.date == value


def _next_position(db: Session, destination) -> int:
    """Append position for a scheduled day or the drawer."""
    return (
        db.query(func.coalesce(func.max(Lesson.position), -1))
        .filter(_same_container_filter(destination))
        .scalar()
        + 1
    )


def _move_lesson(lesson: Lesson, destination, position: int) -> bool:
    """Move a lesson between schedule containers; return whether it moved."""
    if lesson.date == destination:
        lesson.position = position
        return False
    if destination is None:
        lesson.last_scheduled_date = lesson.date
    else:
        lesson.last_scheduled_date = None
    lesson.date = destination
    lesson.position = position
    return True


def _validate_subject(db: Session, subject_id: Optional[int]) -> None:
    """404 when a subject_id is given but doesn't exist."""
    if subject_id is None:
        return
    from app.models.subject import Subject

    if not db.query(Subject.id).filter(Subject.id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")


def _apply_template_links(
    db: Session, lesson: Lesson, links: List[LessonTemplateLinkInput]
) -> None:
    """Sync a lesson's linked templates to ``links``. 404 on any missing
    template, 400 on a duplicated template in the same payload (the unique
    constraint forbids it) or on newly linking an archived template.

    Kept links are updated in place rather than replaced: a delete-and-recreate
    of the same (lesson, template) pair would flush the INSERT before the
    orphan DELETE and trip uq_lesson_template.
    """
    seen: set[int] = set()
    for link in links:
        if link.template_id in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Template {link.template_id} is linked more than once",
            )
        seen.add(link.template_id)

    existing = {lt.template_id: lt for lt in lesson.templates}
    if seen:
        rows = (
            db.query(AssignmentTemplate.id, AssignmentTemplate.is_archived)
            .filter(AssignmentTemplate.id.in_(seen))
            .all()
        )
        archived = {row.id for row in rows if row.is_archived}
        if seen - {row.id for row in rows}:
            raise HTTPException(status_code=404, detail="Assignment template not found")
        newly_archived = (seen - set(existing)) & archived
        if newly_archived:
            raise HTTPException(
                status_code=400,
                detail="Cannot link an archived template. Unarchive it first.",
            )

    desired = []
    for link in links:
        lt = existing.get(link.template_id) or LessonTemplate(
            template_id=link.template_id
        )
        lt.assignment_timing = link.assignment_timing
        lt.due_offset_days = link.due_offset_days
        lt.custom_due_date = link.custom_due_date
        lt.custom_max_points = link.custom_max_points
        lt.custom_instructions = link.custom_instructions
        desired.append(lt)
    lesson.templates = desired


def _apply_materials(lesson: Lesson, materials) -> None:
    """Replace a lesson's materials from input list; position = list order."""
    lesson.materials = [
        LessonMaterial(label=m.label, is_gathered=m.is_gathered, position=i)
        for i, m in enumerate(materials)
    ]


def _apply_resources(lesson: Lesson, resources) -> None:
    """Replace a lesson's resources from input list; position = list order."""
    lesson.resources = [
        LessonResource(label=r.label, url=r.url, position=i)
        for i, r in enumerate(resources)
    ]


@router.get("/", response_model=List[LessonResponse])
def list_lessons(
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[AuthUser, Depends(require_admin_or_permission("lessons:read"))],
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """List lessons, optionally bounded by an inclusive date range."""
    # The calendar API is deliberately scheduled-only; drawer contents have a
    # dedicated endpoint so open-ended callers never expose unscheduled work.
    query = db.query(Lesson).filter(Lesson.date.is_not(None))
    if start_date:
        query = query.filter(Lesson.date >= start_date)
    if end_date:
        query = query.filter(Lesson.date <= end_date)
    return query.order_by(Lesson.date, Lesson.position, Lesson.id).all()


@router.post("/", response_model=LessonWriteResponse)
def create_lesson(
    payload: LessonCreate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("lessons:write"))
    ],
):
    """Create a lesson (+ nested materials/resources/students) and sync SAs."""
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Lesson title is required")

    _validate_subject(db, payload.subject_id)
    students = validate_students(db, payload.student_ids)

    # Append to the day: new lessons land after any existing (reordered) cards.
    next_position = _next_position(db, payload.date)

    lesson = Lesson(
        title=payload.title.strip(),
        date=payload.date,
        subject_id=payload.subject_id,
        objective=payload.objective,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        status=payload.status,
        position=next_position,
        created_by=get_user_id_from_auth(auth_user),
    )
    lesson.students = students
    _apply_template_links(db, lesson, payload.templates)
    _apply_materials(lesson, payload.materials)
    _apply_resources(lesson, payload.resources)

    db.add(lesson)
    db.flush()  # assign lesson.id before syncing assignments

    warnings = sync_lesson_assignments(
        db, lesson, assigned_by=get_user_id_from_auth(auth_user)
    )
    db.commit()
    db.refresh(lesson)

    logger.info("Created lesson %s (%s students)", lesson.id, len(students))
    return LessonWriteResponse(lesson=lesson, warnings=warnings)


@router.post("/batch", response_model=List[LessonWriteResponse])
def batch_lessons(
    payload: LessonBatchInput,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("lessons:write"))
    ],
):
    """Atomically recover/reschedule a selection or copy planning data to new instances."""
    rows = (
        db.query(Lesson)
        .filter(Lesson.id.in_(payload.lesson_ids))
        .order_by(Lesson.date, Lesson.position, Lesson.id)
        .all()
    )
    if len(rows) != len(set(payload.lesson_ids)):
        raise HTTPException(
            status_code=404, detail="A selected lesson no longer exists"
        )
    if payload.action == "restore_taught" and any(
        not row.last_scheduled_date for row in rows
    ):
        raise HTTPException(
            status_code=400, detail="Every selected lesson needs a former date"
        )
    if payload.action == "copy" and (payload.date is None):
        raise HTTPException(
            status_code=400, detail="Choose scheduled lessons and a new starting date"
        )
    selected_students = (
        validate_students(db, payload.student_ids)
        if payload.student_ids is not None
        else None
    )
    result = []
    first_date = min((row.date for row in rows if row.date), default=payload.date)
    for source in rows:
        lesson = source
        if payload.action == "copy":
            offset = payload.date - first_date
            lesson = Lesson(
                title=source.title,
                date=source.date + offset if source.date else payload.date,
                subject_id=source.subject_id,
                objective=source.objective,
                duration_minutes=source.duration_minutes,
                notes=source.notes,
                status=LessonStatus.PLANNED,
                created_by=get_user_id_from_auth(auth_user),
            )
            lesson.students = (
                selected_students
                if selected_students is not None
                else list(source.students)
            )
            _apply_template_links(
                db,
                lesson,
                [
                    LessonTemplateLinkInput(
                        template_id=link.template_id,
                        assignment_timing=link.assignment_timing,
                        due_offset_days=link.due_offset_days,
                        custom_due_date=(
                            link.custom_due_date + offset
                            if link.custom_due_date
                            else None
                        ),
                        custom_max_points=link.custom_max_points,
                        custom_instructions=link.custom_instructions,
                    )
                    for link in source.templates
                    if link.template_id is not None
                ],
            )
            lesson.materials = [
                LessonMaterial(label=m.label, is_gathered=False, position=m.position)
                for m in source.materials
            ]
            lesson.resources = [
                LessonResource(label=r.label, url=r.url, position=r.position)
                for r in source.resources
            ]
            lesson.paperless_materials = [
                LessonPaperlessMaterial(
                    document_id=m.document_id,
                    title=m.title,
                    asn=m.asn,
                    material_kind=m.material_kind,
                )
                for m in source.paperless_materials
            ]
            lesson.position = _next_position(db, lesson.date)
            db.add(lesson)
        else:
            target = (
                source.last_scheduled_date
                if payload.action == "restore_taught"
                else payload.date
            )
            _move_lesson(lesson, target, _next_position(db, target))
            if payload.action == "restore_taught":
                lesson.status = LessonStatus.TAUGHT
        db.flush()
        warnings = sync_lesson_assignments(
            db, lesson, assigned_by=get_user_id_from_auth(auth_user)
        )
        result.append(LessonWriteResponse(lesson=lesson, warnings=warnings))
    db.commit()
    return result


@router.post("/impact", response_model=List[AssignmentImpact])
def preview_assignment_impact(
    payload: LessonImpactInput,
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[AuthUser, Depends(require_admin_or_permission("lessons:write"))],
):
    """Preview changes without mutating lessons or student records."""
    lesson = None
    if payload.lesson_id is not None:
        lesson = db.query(Lesson).filter(Lesson.id == payload.lesson_id).first()
        if lesson is None:
            raise HTTPException(status_code=404, detail="Lesson not found")
    students = validate_students(db, payload.student_ids)
    links = [] if payload.deleting else payload.templates
    template_ids = {link.template_id for link in links}
    templates = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id.in_(template_ids))
        .all()
    )
    if template_ids != {t.id for t in templates}:
        raise HTTPException(status_code=404, detail="Assignment template not found")
    if len(template_ids) != len(links):
        raise HTTPException(
            status_code=400, detail="An activity is linked more than once"
        )
    existing = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.lesson_id == lesson.id)
        .all()
        if lesson
        else []
    )
    return assignment_impact(payload.date, students, links, existing, templates)


@router.get("/drawer", response_model=List[LessonResponse])
def list_drawer_lessons(
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[AuthUser, Depends(require_admin_or_permission("lessons:read"))],
):
    """List unscheduled lessons in drawer order."""
    return (
        db.query(Lesson)
        .filter(Lesson.date.is_(None))
        .order_by(Lesson.position, Lesson.id)
        .all()
    )


@router.post("/rollover", response_model=LessonRolloverResponse)
def rollover_lessons(
    payload: LessonRolloverInput,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("lessons:write"))
    ],
):
    """Move overdue untaught lessons into the drawer.

    ``current_date`` is supplied by the browser so a school's calendar day is
    not accidentally derived from the container's UTC timezone.
    """
    overdue = (
        db.query(Lesson)
        .filter(
            Lesson.date.is_not(None),
            Lesson.date < payload.current_date,
            Lesson.status != LessonStatus.TAUGHT,
        )
        .order_by(Lesson.date, Lesson.position, Lesson.id)
        .with_for_update()
        .all()
    )

    next_position = _next_position(db, None)
    warnings: list[str] = []
    for lesson in overdue:
        _move_lesson(lesson, None, next_position)
        next_position += 1
        db.flush()
        warnings.extend(
            sync_lesson_assignments(
                db, lesson, assigned_by=get_user_id_from_auth(auth_user)
            )
        )

    db.commit()
    drawer = (
        db.query(Lesson)
        .filter(Lesson.date.is_(None))
        .order_by(Lesson.position, Lesson.id)
        .all()
    )
    return LessonRolloverResponse(
        moved_count=len(overdue), lessons=drawer, warnings=warnings
    )


# NOTE: must be registered before GET /{lesson_id} or "my-lessons" would be
# parsed as a lesson id.
@router.get("/my-lessons", response_model=List[StudentLessonResponse])
def get_my_lessons(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student_session("/api/lessons/"))],
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """List the current student's lessons, ordered by date then board position.

    Defaults to today-forward (the upcoming schedule); pass an earlier
    ``start_date`` to include past lessons.
    """
    effective_start = start_date or date.today()
    query = db.query(Lesson).filter(
        Lesson.students.any(User.id == student.id),
        Lesson.date >= effective_start,
    )
    if end_date:
        query = query.filter(Lesson.date <= end_date)
    lessons = query.order_by(Lesson.date, Lesson.position, Lesson.id).all()
    assignments_by_lesson = {}
    if lessons:
        assignments = (
            db.query(StudentAssignment)
            .filter(
                StudentAssignment.lesson_id.in_([lesson.id for lesson in lessons]),
                StudentAssignment.student_id == student.id,
            )
            .order_by(StudentAssignment.id)
            .all()
        )
        for assignment in assignments:
            assignments_by_lesson.setdefault(assignment.lesson_id, []).append(
                assignment
            )
    return [
        StudentLessonResponse.model_validate(lesson).model_copy(
            update={
                "assignments": [
                    LessonAssignmentProgress.model_validate(assignment)
                    for assignment in assignments_by_lesson.get(lesson.id, [])
                ]
            }
        )
        for lesson in lessons
    ]


@router.get("/assignment-progress", response_model=List[LessonAssignmentProgress])
def get_lesson_assignment_progress(
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:read"))
    ],
    school_date: date = Query(..., alias="date"),
):
    """Work navigation for a teacher's selected day in one query.

    Assignment read permission is required independently of lesson read access.
    """
    return (
        db.query(StudentAssignment)
        .join(Lesson, StudentAssignment.lesson_id == Lesson.id)
        .filter(Lesson.date == school_date)
        .order_by(
            StudentAssignment.lesson_id,
            StudentAssignment.template_id,
            StudentAssignment.id,
        )
        .all()
    )


@router.get("/{lesson_id}", response_model=LessonResponse)
def get_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[AuthUser, Depends(require_admin_or_permission("lessons:read"))],
):
    """Fetch a single lesson."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.put("/{lesson_id}", response_model=LessonWriteResponse)
def update_lesson(
    lesson_id: int,
    payload: LessonUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("lessons:write"))
    ],
):
    """Update a lesson (full-replace of nested lists when provided) and sync SAs."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    data = payload.model_dump(exclude_unset=True)

    if "title" in data:
        if not (data["title"] or "").strip():
            raise HTTPException(status_code=400, detail="Lesson title is required")
        lesson.title = data["title"].strip()
    if "subject_id" in data:
        _validate_subject(db, data["subject_id"])
        lesson.subject_id = data["subject_id"]
    if "date" in data and data["date"] != lesson.date:
        _move_lesson(lesson, data["date"], _next_position(db, data["date"]))
    for field in ("objective", "duration_minutes", "notes", "status"):
        if field in data:
            setattr(lesson, field, data[field])

    if payload.student_ids is not None:
        lesson.students = validate_students(db, payload.student_ids)
    if payload.templates is not None:
        _apply_template_links(db, lesson, payload.templates)
    if payload.materials is not None:
        _apply_materials(lesson, payload.materials)
    if payload.resources is not None:
        _apply_resources(lesson, payload.resources)

    db.flush()
    warnings = sync_lesson_assignments(
        db, lesson, assigned_by=get_user_id_from_auth(auth_user)
    )
    db.commit()
    db.refresh(lesson)

    return LessonWriteResponse(lesson=lesson, warnings=warnings)


@router.delete("/{lesson_id}", response_model=LessonDeleteResponse)
def delete_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("lessons:write"))
    ],
):
    """Delete a lesson. Runs the removal pass of sync first (so graded work is
    orphaned rather than deleted), then removes the lesson (materials/resources
    cascade)."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Detach all templates so sync's desired set is empty → all linked SAs are
    # removed (ungraded) or orphaned (graded) before we drop the lesson.
    lesson.templates = []
    db.flush()
    warnings = sync_lesson_assignments(
        db, lesson, assigned_by=get_user_id_from_auth(auth_user)
    )

    db.delete(lesson)
    db.commit()

    return LessonDeleteResponse(message="Lesson deleted", warnings=warnings)


@router.patch("/{lesson_id}/materials/{material_id}", response_model=LessonResponse)
def toggle_material(
    lesson_id: int,
    material_id: int,
    payload: LessonMaterialToggle,
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[AuthUser, Depends(require_admin_or_permission("lessons:write"))],
):
    """Toggle a single material's gathered flag (Teach-mode checkbox)."""
    material = (
        db.query(LessonMaterial)
        .filter(
            LessonMaterial.id == material_id,
            LessonMaterial.lesson_id == lesson_id,
        )
        .first()
    )
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    material.is_gathered = payload.is_gathered
    db.commit()

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    return lesson


@router.patch("/reorder", response_model=LessonReorderResponse)
def reorder_lessons(
    payload: LessonReorderInput,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("lessons:write"))
    ],
):
    """Reorder lessons within a day (and move cards across days).

    ``payload.lesson_ids`` is the full top-to-bottom order of ``payload.date``
    after a drag. Each listed lesson's ``position`` becomes its index; any that
    were on a different date are moved to ``payload.date`` (cross-day drag) and
    re-synced so linked assignments follow. Moving or reordering a lesson
    preserves its status, including taught lessons.
    """
    if not payload.lesson_ids:
        return LessonReorderResponse(lessons=[], warnings=[])

    lessons = db.query(Lesson).filter(Lesson.id.in_(payload.lesson_ids)).all()
    by_id = {lesson.id: lesson for lesson in lessons}
    missing = [lid for lid in payload.lesson_ids if lid not in by_id]
    if missing:
        raise HTTPException(
            status_code=404, detail=f"Lessons not found: {sorted(missing)}"
        )

    moved: list[Lesson] = []
    for index, lesson_id in enumerate(payload.lesson_ids):
        lesson = by_id[lesson_id]
        changes_date = lesson.date != payload.date
        lesson.position = index
        if changes_date:
            _move_lesson(lesson, payload.date, index)
            moved.append(lesson)

    warnings: list[str] = []
    if moved:
        db.flush()
        for lesson in moved:
            warnings.extend(
                sync_lesson_assignments(
                    db, lesson, assigned_by=get_user_id_from_auth(auth_user)
                )
            )

    db.commit()

    result = (
        db.query(Lesson)
        .filter(_same_container_filter(payload.date))
        .order_by(Lesson.position, Lesson.id)
        .all()
    )
    return LessonReorderResponse(lessons=result, warnings=warnings)


@router.patch("/{lesson_id}/status", response_model=LessonResponse)
def set_status(
    lesson_id: int,
    payload: LessonStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    _auth: Annotated[AuthUser, Depends(require_admin_or_permission("lessons:write"))],
):
    """Set a lesson's status (mark-taught toggle)."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.status = payload.status
    db.commit()
    db.refresh(lesson)
    return lesson
