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

"""APIs for assignments."""

from fastapi import APIRouter

from .analytics import router as analytics_router
from .grading import router as grading_router
from .student_assignments import (
    STUDENT_EDITABLE_ASSIGNMENT_FIELDS,
    router as student_assignments_router,
)
from .templates import router as templates_router

router = APIRouter()

router.include_router(templates_router)
router.include_router(student_assignments_router)
router.include_router(grading_router)
router.include_router(analytics_router)

__all__ = ["router", "STUDENT_EDITABLE_ASSIGNMENT_FIELDS"]
