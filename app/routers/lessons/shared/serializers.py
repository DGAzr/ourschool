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

"""Serialization utilities for lessons module."""
from typing import Dict, Any

from app.models.lesson import LessonAssignment


def serialize_assignment_template(lesson_assignment: LessonAssignment) -> Dict[str, Any]:
    """Serialize assignment template data for API responses.
    
    Args:
        lesson_assignment: The lesson assignment with loaded assignment template
        
    Returns:
        Dictionary with assignment template data
    """
    return {
        "id": lesson_assignment.assignment_template.id,
        "name": lesson_assignment.assignment_template.name,
        "assignment_type": lesson_assignment.assignment_template.assignment_type,
        "max_points": lesson_assignment.assignment_template.max_points,
        "estimated_duration_minutes": lesson_assignment.assignment_template.estimated_duration_minutes,
        "description": lesson_assignment.assignment_template.description,
    }


def serialize_lesson_assignment_response(lesson_assignment: LessonAssignment) -> Dict[str, Any]:
    """Serialize lesson assignment for API response.
    
    Args:
        lesson_assignment: The lesson assignment with loaded assignment template
        
    Returns:
        Dictionary with lesson assignment response data
    """
    return {
        "id": lesson_assignment.id,
        "lesson_id": lesson_assignment.lesson_id,
        "assignment_template_id": lesson_assignment.assignment_template_id,
        "order_in_lesson": lesson_assignment.order_in_lesson,
        "planned_duration_minutes": lesson_assignment.planned_duration_minutes,
        "custom_instructions": lesson_assignment.custom_instructions,
        "is_required": lesson_assignment.is_required,
        "custom_max_points": lesson_assignment.custom_max_points,
        "created_at": lesson_assignment.created_at,
        "assignment_template": serialize_assignment_template(lesson_assignment),
    }