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

"""Attendance models."""
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.enums import AttendanceStatus


class AttendanceRecord(Base):
    """Attendance records for students."""

    __tablename__ = "attendance_records"

    __table_args__ = (
        Index("idx_attendance_records_student_date", "student_id", "date"),
        UniqueConstraint("student_id", "date", name="uq_attendance_student_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date = Column(Date, nullable=False)
    status = Column(
        Enum(AttendanceStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    student = relationship("User", back_populates="attendance_records")