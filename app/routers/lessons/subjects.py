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

"""APIs for subject management."""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.assignment import AssignmentTemplate
from app.models.lesson import Subject
from app.models.user import User
from app.routers.auth import get_current_active_user
from app.schemas.lesson import SubjectCreate, SubjectUpdate
from app.schemas.lesson import Subject as SubjectSchema

from .shared import get_subject_or_404, require_admin

router = APIRouter()


@router.post("/", response_model=SubjectSchema)
def create_subject(
    subject: SubjectCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Create a new subject."""
    db_subject = Subject(**subject.dict())
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.get("/", response_model=List[SubjectSchema])
def read_subjects(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all subjects."""
    return db.query(Subject).all()


@router.put("/{subject_id}", response_model=SubjectSchema)
def update_subject(
    subject_id: int,
    subject_update: SubjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Update a subject."""
    subject = get_subject_or_404(db, subject_id)

    update_data = subject_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Delete a subject."""
    subject = get_subject_or_404(db, subject_id)

    # Check if there are assignment templates using this subject
    templates_count = db.query(AssignmentTemplate).filter(
        AssignmentTemplate.subject_id == subject_id
    ).count()
    if templates_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete subject. It is used by {templates_count} assignment template(s).",
        )

    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully"}