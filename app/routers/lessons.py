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
from app.models.assignment import AssignmentTemplate
from app.models.lesson import Lesson, LessonMaterial, LessonResource, LessonTemplate
from app.models.user import User
from app.schemas.lesson import (
    LessonCreate,
    LessonDeleteResponse,
    LessonMaterialToggle,
    LessonReorderInput,
    LessonReorderResponse,
    LessonResponse,
    LessonStatusUpdate,
    LessonTemplateLinkInput,
    LessonUpdate,
    LessonWriteResponse,
    StudentLessonResponse,
)
from app.routers.validators import validate_students
from app.services.lesson_assignments import sync_lesson_assignments

logger = logging.getLogger(__name__)
router = APIRouter()


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
    query = db.query(Lesson)
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
    next_position = (
        db.query(func.coalesce(func.max(Lesson.position), -1))
        .filter(Lesson.date == payload.date)
        .scalar()
        + 1
    )

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
    return query.order_by(Lesson.date, Lesson.position, Lesson.id).all()


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
    for field in ("date", "objective", "duration_minutes", "notes", "status"):
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
    re-synced so linked assignments follow. Taught lessons are locked: attempting
    to move or re-rank one is rejected.
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

    # Taught lessons are locked by rank, not raw position: cross-day moves and
    # deletions leave holes in the day's position sequence, so a drop that
    # keeps a taught lesson in the same visual slot may still renumber it.
    current_rank = {
        lesson.id: rank
        for rank, lesson in enumerate(
            sorted(
                (lesson for lesson in lessons if lesson.date == payload.date),
                key=lambda lesson: (lesson.position, lesson.id),
            )
        )
    }

    moved: list[Lesson] = []
    for index, lesson_id in enumerate(payload.lesson_ids):
        lesson = by_id[lesson_id]
        changes_date = lesson.date != payload.date
        changes_rank = current_rank.get(lesson.id) != index
        if lesson.status == LessonStatus.TAUGHT and (changes_date or changes_rank):
            raise HTTPException(
                status_code=400,
                detail="Taught lessons cannot be reordered or moved",
            )
        lesson.position = index
        if changes_date:
            lesson.date = payload.date
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
        .filter(Lesson.date == payload.date)
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
