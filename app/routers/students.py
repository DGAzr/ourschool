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

"""APIs for students."""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.user import User as UserSchema
from app.schemas.user import UserCreate, UserUpdate

router = APIRouter()


@router.post("/", response_model=UserSchema)
def create_student(
    student: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new student user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can create student records"
        )

    # Create student user with STUDENT role
    db_student = User(
        email=student.email,
        username=student.username,
        hashed_password=student.hashed_password,
        first_name=student.first_name,
        last_name=student.last_name,
        role=UserRole.STUDENT,
        parent_id=current_user.id,
        date_of_birth=student.date_of_birth,
        grade_level=student.grade_level,
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


@router.get("/", response_model=List[UserSchema])
def read_students(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all student users."""
    if current_user.role == UserRole.ADMIN:
        # Admins see all students in homeschool context
        students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    else:
        # Students only see their own profile
        students = db.query(User).filter(User.id == current_user.id, User.role == UserRole.STUDENT).all()
    return students


@router.get("/{student_id}", response_model=UserSchema)
def read_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific student user."""
    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Admins have access to all students in homeschool context
    if current_user.role == UserRole.STUDENT and student.id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return student


@router.put("/{student_id}", response_model=UserSchema)
def update_student(
    student_id: int,
    student_update: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a student user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can update student records"
        )

    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = student_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a student user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can delete student records"
        )

    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    db.delete(student)
    db.commit()
    return {"message": "Student deleted successfully"}