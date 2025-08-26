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

"""Shared utilities for lessons module."""
from .permissions import check_admin_access, require_admin
from .serializers import serialize_assignment_template, serialize_lesson_assignment_response
from .validators import (
    get_assignment_template_or_404,
    get_lesson_assignment_or_404,
    get_lesson_or_404,
    get_or_404,
    get_subject_or_404,
)

__all__ = [
    "check_admin_access",
    "require_admin", 
    "get_assignment_template_or_404",
    "get_lesson_assignment_or_404", 
    "get_lesson_or_404",
    "get_or_404",
    "get_subject_or_404",
    "serialize_assignment_template",
    "serialize_lesson_assignment_response",
]