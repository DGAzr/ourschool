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

"""Lesson schemas."""
from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, Field



class SubjectBase(BaseModel):
    """Base schema for subjects."""

    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"


class SubjectCreate(SubjectBase):
    """Schema for creating subjects."""


class SubjectUpdate(BaseModel):
    """Schema for updating subjects."""

    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class Subject(SubjectBase):
    """Schema for subjects."""

    id: int
    created_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonBase(BaseModel):
    """Base schema for lessons."""

    title: str
    description: Optional[str] = None
    scheduled_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    estimated_duration_minutes: Optional[int] = None
    materials_needed: Optional[str] = None
    objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    resources: Optional[str] = None
    lesson_order: int = 0


class LessonCreate(LessonBase):
    """Schema for creating lessons."""


class LessonUpdate(BaseModel):
    """Schema for updating lessons."""

    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    estimated_duration_minutes: Optional[int] = None
    materials_needed: Optional[str] = None
    objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    resources: Optional[str] = None
    lesson_order: Optional[int] = None


class Lesson(LessonBase):
    """Schema for lessons."""

    id: int
    created_at: datetime
    updated_at: datetime
    subjects: List[Subject] = []
    subject_names: List[str] = []
    subject_colors: List[str] = []
    primary_subject: Optional[Subject] = None

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# Lesson Assignment Schemas (for grouping assignments within lessons)


class LessonAssignmentBase(BaseModel):
    """Base schema for lesson assignments."""

    assignment_template_id: int
    order_in_lesson: int = 0
    planned_duration_minutes: Optional[int] = None
    custom_instructions: Optional[str] = None
    is_required: bool = True
    custom_max_points: Optional[int] = None


class LessonAssignmentCreate(LessonAssignmentBase):
    """Schema for creating lesson assignments."""


class LessonAssignmentUpdate(BaseModel):
    """Schema for updating lesson assignments."""

    assignment_template_id: Optional[int] = None
    order_in_lesson: Optional[int] = None
    planned_duration_minutes: Optional[int] = None
    custom_instructions: Optional[str] = None
    is_required: Optional[bool] = None
    custom_max_points: Optional[int] = None


class LessonAssignmentResponse(LessonAssignmentBase):
    """Schema for responding with lesson assignments."""

    id: int
    lesson_id: int
    created_at: datetime
    # Include assignment template details
    assignment_template: Optional[dict] = None  # Will be populated with template info

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# Enhanced lesson schemas with assignment groupings


class LessonWithAssignments(Lesson):
    """Schema for lessons with assignments."""

    assignments: List[LessonAssignmentResponse] = []
    total_planned_duration: Optional[int] = None  # Sum of all planned durations
    assignment_count: int = 0


class LessonCreateWithAssignments(LessonBase):
    """Schema for creating lessons with assignments."""

    assignments: List[LessonAssignmentCreate] = []


class LessonUpdateWithAssignments(LessonUpdate):
    """Schema for updating lessons with assignments."""

    assignments: Optional[List[LessonAssignmentCreate]] = None


# Lesson assignment workflow schemas


class AssignLessonRequest(BaseModel):
    """Schema for assigning lessons."""

    lesson_id: int
    student_ids: List[int] = Field(..., min_items=1)
    due_date: Optional[date] = None
    custom_instructions: Optional[str] = None


class AssignLessonResponse(BaseModel):
    """Schema for responding to lesson assignment requests."""

    success_count: int
    failed_assignments: List[dict] = []
    created_student_assignments: List[dict] = []
    created_assignment_instances: List[dict] = (
        []
    )  # Individual assignment instances created


# Lesson progress and analytics


class LessonProgressSummary(BaseModel):
    """Schema for lesson progress summaries."""

    lesson_id: int
    lesson_title: str
    student_id: int
    student_name: str
    total_assignments: int
    completed_assignments: int
    total_possible_points: int
    total_earned_points: int
    completion_percentage: float
    average_grade: Optional[float] = None
    estimated_time_remaining: Optional[int] = None  # in minutes


# Export/Import schemas for sharing lessons between families


class AssignmentTemplateExportData(BaseModel):
    """Schema for exporting assignment template data within lessons."""
    
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    assignment_type: str
    subject_name: str
    max_points: int = 100
    estimated_duration_minutes: Optional[int] = None
    prerequisites: Optional[str] = None
    materials_needed: Optional[str] = None
    order_in_lesson: int = 0
    planned_duration_minutes: Optional[int] = None
    custom_instructions: Optional[str] = None
    is_required: bool = True
    custom_max_points: Optional[int] = None


class LessonExportData(BaseModel):
    """Schema for exporting lesson data for sharing."""
    
    title: str
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    materials_needed: Optional[str] = None
    objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    resources: Optional[str] = None
    lesson_order: int = 0
    assignments: List[AssignmentTemplateExportData] = []
    subject_names: List[str] = []


class LessonExport(BaseModel):
    """Schema for complete lesson export package."""
    
    format_version: str = "1.0"
    export_timestamp: datetime
    exported_by: str
    lesson_data: LessonExportData
    metadata: dict = {}


class LessonImportRequest(BaseModel):
    """Schema for importing lesson data."""
    
    lesson_export: LessonExport
    target_date: Optional[date] = None
    subject_mappings: Optional[dict] = None  # Map imported subject names to local subject IDs
    create_missing_subjects: bool = True


class LessonImportResponse(BaseModel):
    """Schema for lesson import response."""
    
    success: bool
    lesson_id: Optional[int] = None
    created_lesson: Optional[Lesson] = None
    created_assignments: List[int] = []
    created_subjects: List[int] = []
    warnings: List[str] = []
    errors: List[str] = []