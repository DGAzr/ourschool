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

"""APIs for lesson management."""
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.assignment import AssignmentTemplate
from app.models.lesson import Lesson, LessonAssignment
from app.models.user import User
from app.routers.auth import get_current_active_user
from app.schemas.lesson import LessonCreate, LessonUpdate
from app.schemas.lesson import Lesson as LessonSchema

from .shared import get_lesson_or_404, require_admin

router = APIRouter()


@router.post("/", response_model=LessonSchema)
def create_lesson(
    lesson: LessonCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Create a new lesson."""
    # No need to validate subject_id since lessons no longer have direct subject relationship
    db_lesson = Lesson(**lesson.dict())
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return db_lesson


@router.get("/", response_model=List[LessonSchema])
def read_lessons(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    subject_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
):
    """Get all lessons."""
    query = db.query(Lesson)

    if start_date:
        query = query.filter(Lesson.scheduled_date >= start_date)
    if end_date:
        query = query.filter(Lesson.scheduled_date <= end_date)
    if subject_id:
        # Filter lessons by subject through their assignments
        query = query.join(LessonAssignment).join(AssignmentTemplate).filter(
            AssignmentTemplate.subject_id == subject_id
        )

    # Note: student_id filtering removed with lesson plan system

    return query.order_by(Lesson.lesson_order, Lesson.scheduled_date).all()


@router.get("/{lesson_id}", response_model=LessonSchema)
def read_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific lesson."""
    return get_lesson_or_404(db, lesson_id)


@router.put("/{lesson_id}", response_model=LessonSchema)
def update_lesson(
    lesson_id: int,
    lesson_update: LessonUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Update a lesson."""
    lesson = get_lesson_or_404(db, lesson_id)

    update_data = lesson_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)

    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Delete a lesson."""
    lesson = get_lesson_or_404(db, lesson_id)

    db.delete(lesson)
    db.commit()
    return {"message": "Lesson deleted successfully"}