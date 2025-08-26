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

"""User models."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.enums import UserRole


class User(Base):
    """User model."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(
        Enum(UserRole, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    is_active = Column(Boolean, default=True)

    # Student-specific fields (only populated for student users)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    grade_level = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships for parent role (when this user is an admin managing students)
    # This user manages students (one-to-many: one parent manages many students)
    managed_students = relationship(
        "User",
        back_populates="parent",
        foreign_keys="User.parent_id",
        cascade="all, delete-orphan",
    )
    # This user has a parent (many-to-one: many students have one parent)
    parent = relationship(
        "User",
        back_populates="managed_students",
        foreign_keys=[parent_id],
        remote_side=[id],
    )

    # Direct relationships to academic records (for student users)
    attendance_records = relationship(
        "AttendanceRecord", back_populates="student", cascade="all, delete-orphan"
    )
    assigned_assignments = relationship(
        "StudentAssignment",
        foreign_keys="StudentAssignment.student_id",
        back_populates="student",
        cascade="all, delete-orphan",
    )

    # Journal entries (for student users)
    journal_entries = relationship(
        "JournalEntry",
        back_populates="student",
        foreign_keys="JournalEntry.student_id",
        cascade="all, delete-orphan",
    )

    # Lesson planning relationships removed - using direct assignment system

    # Points system relationships (for student users)
    student_points = relationship(
        "StudentPoints",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan"
    )
    point_transactions = relationship(
        "PointTransaction",
        foreign_keys="PointTransaction.student_id",
        back_populates="student",
        cascade="all, delete-orphan"
    )