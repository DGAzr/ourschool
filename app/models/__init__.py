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

"""Models package."""

# Import all models to ensure they are registered with SQLAlchemy
from .api_key import APIKey
from .assignment import (
    AssignmentTimeEntry,
    AssignmentStatus,
    AssignmentTemplate,
    AssignmentType,
    StudentAssignment,
)
from .assignment_type import AssignmentTypeConfig
from .attendance import AttendanceRecord, AttendanceStatus
from .journal import JournalEntry, JournalReply
from .lesson import (
    Lesson,
    LessonMaterial,
    LessonResource,
    LessonTemplate,
    lesson_students,
)
from .paperless import (
    LessonPaperlessMaterial,
    PaperlessConnection,
    PaperlessDoctypeMap,
    PaperlessDocument,
    PaperlessTagMap,
    PaperlessThumbnail,
    StudentAssignmentPaperlessMaterial,
    TemplatePaperlessMaterial,
)
from .shop import ShopCategory, ShopImage, ShopItem, ShopRedemption
from .subject import Subject
from .term import GradeHistory, StudentTermGrade, Term, TermSubject, TermType
from .user import User, UserRole
from .points import StudentPoints, PointTransaction, SystemSettings

__all__ = [
    "APIKey",
    "AssignmentStatus",
    "AssignmentTimeEntry",
    "AssignmentTemplate",
    "AssignmentType",
    "AssignmentTypeConfig",
    "AttendanceRecord",
    "AttendanceStatus",
    "GradeHistory",
    "JournalEntry",
    "JournalReply",
    "Lesson",
    "LessonMaterial",
    "LessonPaperlessMaterial",
    "LessonResource",
    "LessonTemplate",
    "lesson_students",
    "PaperlessConnection",
    "PaperlessDoctypeMap",
    "PaperlessDocument",
    "PaperlessTagMap",
    "PaperlessThumbnail",
    "PointTransaction",
    "ShopCategory",
    "ShopImage",
    "ShopItem",
    "ShopRedemption",
    "StudentAssignment",
    "StudentAssignmentPaperlessMaterial",
    "StudentPoints",
    "StudentTermGrade",
    "Subject",
    "SystemSettings",
    "TemplatePaperlessMaterial",
    "Term",
    "TermSubject",
    "TermType",
    "User",
    "UserRole",
]
