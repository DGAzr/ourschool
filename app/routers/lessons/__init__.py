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

"""Lessons router module - refactored from monolithic lessons.py.

This module organizes lesson-related endpoints into logical sub-modules:
- subjects.py: Subject CRUD operations
- lessons.py: Lesson CRUD operations  
- lesson_assignments.py: Lesson-assignment relationships
- lesson_operations.py: Lesson operations (assign, export, import)
- shared/: Common utilities (permissions, validators, serializers)
"""
from fastapi import APIRouter

from . import lesson_assignments, lesson_operations, lessons, subjects

# Create the main lessons router
router = APIRouter()

# Include sub-routers with appropriate prefixes
router.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
router.include_router(lessons.router, tags=["lessons"])  # No prefix for lessons (root paths)
router.include_router(lesson_assignments.router, tags=["lesson-assignments"])
router.include_router(lesson_operations.router, tags=["lesson-operations"])

__all__ = ["router"]