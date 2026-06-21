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

"""Subject management API."""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.assignment import AssignmentTemplate
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.subject import Subject as SubjectSchema, SubjectCreate, SubjectUpdate

router = APIRouter()


def _require_admin(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can perform this action")
    return current_user


def _get_subject_or_404(db: Session, subject_id: int) -> Subject:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.get("/", response_model=List[SubjectSchema])
def list_subjects(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """List all subjects."""
    return db.query(Subject).order_by(Subject.name).all()


@router.post("/", response_model=SubjectSchema)
def create_subject(
    subject: SubjectCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(_require_admin)],
):
    """Create a new subject."""
    db_subject = Subject(**subject.dict())
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.put("/{subject_id}", response_model=SubjectSchema)
def update_subject(
    subject_id: int,
    subject_update: SubjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(_require_admin)],
):
    """Update a subject."""
    subject = _get_subject_or_404(db, subject_id)
    for field, value in subject_update.dict(exclude_unset=True).items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(_require_admin)],
):
    """Delete a subject. Blocked if any assignment templates reference it."""
    subject = _get_subject_or_404(db, subject_id)
    templates_count = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.subject_id == subject_id)
        .count()
    )
    if templates_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete subject: {templates_count} assignment template(s) are using it.",
        )
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully"}
