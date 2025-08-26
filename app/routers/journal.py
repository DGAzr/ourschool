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

"""Journal entry router."""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.enums import UserRole
from app.models.journal import JournalEntry
from app.models.user import User
from app.schemas.journal import (
    JournalEntryCreate,
    JournalEntryResponse,
    JournalEntryUpdate,
    JournalEntryWithAuthor,
)

router = APIRouter(tags=["journal"])


def get_user_with_permission(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current user and verify they have journal permissions."""
    if current_user.role not in [UserRole.ADMIN, UserRole.STUDENT]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for journal access",
        )
    return current_user


@router.get("/entries", response_model=List[JournalEntryWithAuthor])
async def get_journal_entries(
    student_id: int = None,
    current_user: User = Depends(get_user_with_permission),
    db: Session = Depends(get_db),
):
    """Get journal entries with role-based filtering."""
    
    query = db.query(JournalEntry)
    
    if current_user.role == UserRole.STUDENT:
        # Students can only view their own entries
        query = query.filter(JournalEntry.student_id == current_user.id)
    elif current_user.role == UserRole.ADMIN:
        # Admins can view all entries or filter by student_id
        if student_id:
            query = query.filter(JournalEntry.student_id == student_id)
    
    entries = query.order_by(JournalEntry.entry_date.desc()).all()
    
    # Transform to response model with author and student names
    result = []
    for entry in entries:
        author = db.query(User).filter(User.id == entry.author_id).first()
        student = db.query(User).filter(User.id == entry.student_id).first()
        
        result.append(
            JournalEntryWithAuthor(
                id=entry.id,
                student_id=entry.student_id,
                author_id=entry.author_id,
                title=entry.title,
                content=entry.content,
                entry_date=entry.entry_date,
                created_at=entry.created_at,
                updated_at=entry.updated_at,
                author_name=f"{author.first_name} {author.last_name}",
                student_name=f"{student.first_name} {student.last_name}",
                is_own_entry=entry.author_id == current_user.id,
            )
        )
    
    return result


@router.get("/entries/{entry_id}", response_model=JournalEntryWithAuthor)
async def get_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_user_with_permission),
    db: Session = Depends(get_db),
):
    """Get a specific journal entry."""
    
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal entry not found",
        )
    
    # Check permissions
    if current_user.role == UserRole.STUDENT and entry.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own journal entries",
        )
    
    author = db.query(User).filter(User.id == entry.author_id).first()
    student = db.query(User).filter(User.id == entry.student_id).first()
    
    return JournalEntryWithAuthor(
        id=entry.id,
        student_id=entry.student_id,
        author_id=entry.author_id,
        title=entry.title,
        content=entry.content,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        author_name=f"{author.first_name} {author.last_name}",
        student_name=f"{student.first_name} {student.last_name}",
        is_own_entry=entry.author_id == current_user.id,
    )


@router.post("/entries", response_model=JournalEntryResponse)
async def create_journal_entry(
    entry_data: JournalEntryCreate,
    current_user: User = Depends(get_user_with_permission),
    db: Session = Depends(get_db),
):
    """Create a new journal entry."""
    
    # Determine the student_id
    if current_user.role == UserRole.STUDENT:
        # Students create entries for themselves
        student_id = current_user.id
    elif current_user.role == UserRole.ADMIN:
        # Admins can create entries for any student
        if not entry_data.student_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="student_id is required for admin users",
            )
        student_id = entry_data.student_id
        
        # Verify the student exists and is actually a student
        student = db.query(User).filter(
            User.id == student_id,
            User.role == UserRole.STUDENT,
        ).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )
    
    # Create the entry
    entry = JournalEntry(
        student_id=student_id,
        author_id=current_user.id,
        title=entry_data.title,
        content=entry_data.content,
        entry_date=entry_data.entry_date or datetime.utcnow(),
    )
    
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return entry


@router.put("/entries/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: int,
    entry_data: JournalEntryUpdate,
    current_user: User = Depends(get_user_with_permission),
    db: Session = Depends(get_db),
):
    """Update a journal entry."""
    
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal entry not found",
        )
    
    # Check permissions - only admins or the original author can edit
    if current_user.role == UserRole.STUDENT and entry.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own journal entries",
        )
    
    # Update fields if provided
    if entry_data.title is not None:
        entry.title = entry_data.title
    if entry_data.content is not None:
        entry.content = entry_data.content
    if entry_data.entry_date is not None:
        entry.entry_date = entry_data.entry_date
    
    db.commit()
    db.refresh(entry)
    
    return entry


@router.delete("/entries/{entry_id}")
async def delete_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_user_with_permission),
    db: Session = Depends(get_db),
):
    """Delete a journal entry."""
    
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal entry not found",
        )
    
    # Check permissions - only admins or the original author can delete
    if current_user.role == UserRole.STUDENT and entry.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own journal entries",
        )
    
    db.delete(entry)
    db.commit()
    
    return {"message": "Journal entry deleted successfully"}


@router.get("/students", response_model=List[dict])
async def get_students_for_journal(
    current_user: User = Depends(get_user_with_permission),
    db: Session = Depends(get_db),
):
    """Get list of students (for admin users to select when creating entries)."""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access student list",
        )
    
    students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    
    return [
        {
            "id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "email": student.email,
        }
        for student in students
    ]