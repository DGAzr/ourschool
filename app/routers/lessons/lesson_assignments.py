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

"""APIs for lesson-assignment management."""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.lesson import LessonAssignment
from app.models.user import User
from app.routers.auth import get_current_active_user
from app.schemas.lesson import (
    LessonAssignmentCreate,
    LessonAssignmentResponse,
    LessonAssignmentUpdate,
    LessonWithAssignments,
)

from .shared import (
    get_assignment_template_or_404,
    get_lesson_assignment_or_404,
    get_lesson_or_404,
    require_admin,
    serialize_lesson_assignment_response,
)

router = APIRouter()


@router.post("/{lesson_id}/assignments", response_model=LessonAssignmentResponse)
def add_assignment_to_lesson(
    lesson_id: int,
    assignment_data: LessonAssignmentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Add an assignment template to a lesson with specific ordering and timing."""
    # Verify lesson exists
    lesson = get_lesson_or_404(db, lesson_id)

    # Verify assignment template exists
    template = get_assignment_template_or_404(db, assignment_data.assignment_template_id)

    # Check if assignment is already in this lesson
    existing = (
        db.query(LessonAssignment)
        .filter(
            LessonAssignment.lesson_id == lesson_id,
            LessonAssignment.assignment_template_id == assignment_data.assignment_template_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Assignment is already part of this lesson"
        )

    # Create lesson assignment
    lesson_assignment = LessonAssignment(lesson_id=lesson_id, **assignment_data.dict())

    db.add(lesson_assignment)
    db.commit()
    db.refresh(lesson_assignment)

    return serialize_lesson_assignment_response(lesson_assignment)


@router.get("/{lesson_id}/assignments", response_model=List[LessonAssignmentResponse])
def get_lesson_assignments(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all assignments for a specific lesson."""
    lesson = get_lesson_or_404(db, lesson_id)

    assignments = (
        db.query(LessonAssignment)
        .filter(LessonAssignment.lesson_id == lesson_id)
        .order_by(LessonAssignment.order_in_lesson)
        .all()
    )

    return [serialize_lesson_assignment_response(assignment) for assignment in assignments]


@router.put("/{lesson_id}/assignments/{assignment_id}", response_model=LessonAssignmentResponse)
def update_lesson_assignment(
    lesson_id: int,
    assignment_id: int,
    assignment_update: LessonAssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Update a lesson assignment's ordering, timing, or other metadata."""
    lesson_assignment = (
        db.query(LessonAssignment)
        .filter(
            LessonAssignment.id == assignment_id,
            LessonAssignment.lesson_id == lesson_id,
        )
        .first()
    )

    if not lesson_assignment:
        raise HTTPException(status_code=404, detail="Lesson assignment not found")

    update_data = assignment_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson_assignment, field, value)

    db.commit()
    db.refresh(lesson_assignment)

    return serialize_lesson_assignment_response(lesson_assignment)


@router.delete("/{lesson_id}/assignments/{assignment_id}")
def remove_assignment_from_lesson(
    lesson_id: int,
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Remove an assignment from a lesson."""
    lesson_assignment = (
        db.query(LessonAssignment)
        .filter(
            LessonAssignment.id == assignment_id,
            LessonAssignment.lesson_id == lesson_id,
        )
        .first()
    )

    if not lesson_assignment:
        raise HTTPException(status_code=404, detail="Lesson assignment not found")

    db.delete(lesson_assignment)
    db.commit()

    return {"message": "Assignment removed from lesson successfully"}


@router.get("/{lesson_id}/with-assignments", response_model=LessonWithAssignments)
def get_lesson_with_assignments(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a lesson with all its assignments and computed metadata."""
    lesson = get_lesson_or_404(db, lesson_id)

    # Get lesson assignments with template details
    assignments = (
        db.query(LessonAssignment)
        .filter(LessonAssignment.lesson_id == lesson_id)
        .order_by(LessonAssignment.order_in_lesson)
        .all()
    )

    # Populate assignment template details and calculate totals
    total_planned_duration = 0
    assignment_responses = []

    for assignment in assignments:
        assignment_dict = serialize_lesson_assignment_response(assignment)
        assignment_responses.append(assignment_dict)

        if assignment.planned_duration_minutes:
            total_planned_duration += assignment.planned_duration_minutes

    # Create response
    lesson_dict = {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "subjects": lesson.subjects,
        "subject_names": lesson.subject_names,
        "subject_colors": lesson.subject_colors,
        "primary_subject": lesson.primary_subject,
        "scheduled_date": lesson.scheduled_date,
        "start_time": lesson.start_time,
        "end_time": lesson.end_time,
        "estimated_duration_minutes": lesson.estimated_duration_minutes,
        "materials_needed": lesson.materials_needed,
        "objectives": lesson.objectives,
        "prerequisites": lesson.prerequisites,
        "resources": lesson.resources,
        "lesson_order": lesson.lesson_order,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
        "assignments": assignment_responses,
        "total_planned_duration": total_planned_duration if total_planned_duration > 0 else None,
        "assignment_count": len(assignments),
    }

    return lesson_dict