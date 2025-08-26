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

"""
Centralized enum definitions for the OurSchool application.

This module contains all enum definitions used throughout the application,
providing a single source of truth and preventing inconsistencies.

All enums follow the pattern:
- Uppercase enum names (e.g., PRESENT, BEGINNER)  
- Lowercase string values (e.g., "present", "beginner")
- Values match database enum values
- Values match frontend type definitions
"""

import enum


class AttendanceStatus(enum.Enum):
    """Status values for attendance records."""

    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"



class AssignmentType(enum.Enum):
    """Types of assignments available in the system."""

    HOMEWORK = "homework"
    PROJECT = "project"
    TEST = "test"
    QUIZ = "quiz"
    ESSAY = "essay"
    PRESENTATION = "presentation"
    WORKSHEET = "worksheet"
    READING = "reading"
    PRACTICE = "practice"


class AssignmentStatus(enum.Enum):
    """Status values for student assignments."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"
    OVERDUE = "overdue"
    EXCUSED = "excused"


class UserRole(enum.Enum):
    """User roles in the system."""

    ADMIN = "admin"  # Parent/Administrator with full access
    STUDENT = "student"


class TermType(enum.Enum):
    """Types of academic terms."""

    SEMESTER = "semester"
    QUARTER = "quarter"
    TRIMESTER = "trimester"
    CUSTOM = "custom"
