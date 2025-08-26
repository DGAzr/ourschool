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

"""Journal schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class JournalEntryBase(BaseModel):
    """Base journal entry schema."""
    
    title: str
    content: str
    entry_date: Optional[datetime] = None


class JournalEntryCreate(JournalEntryBase):
    """Schema for creating a journal entry."""
    
    student_id: Optional[int] = None  # Optional for students creating their own entries


class JournalEntryUpdate(BaseModel):
    """Schema for updating a journal entry."""
    
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[datetime] = None


class JournalEntryResponse(JournalEntryBase):
    """Schema for journal entry response."""
    
    id: int
    student_id: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class JournalEntryWithAuthor(JournalEntryResponse):
    """Schema for journal entry response with author information."""
    
    author_name: str
    student_name: str
    is_own_entry: bool  # True if the requesting user is the author