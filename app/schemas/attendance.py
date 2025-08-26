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

"""Attendance schemas."""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.enums import AttendanceStatus


class AttendanceRecordBase(BaseModel):
    """Base schema for attendance records."""

    student_id: int
    date: date
    status: AttendanceStatus
    notes: Optional[str] = None


class AttendanceRecordCreate(AttendanceRecordBase):
    """Schema for creating attendance records."""


class AttendanceRecordUpdate(BaseModel):
    """Schema for updating attendance records."""

    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None


class AttendanceRecord(AttendanceRecordBase):
    """Schema for attendance records."""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class BulkAttendanceCreate(BaseModel):
    """Schema for creating attendance records in bulk."""

    student_ids: List[int]
    date: date
    status: AttendanceStatus
    notes: Optional[str] = None