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

"""Assignment schemas."""
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional
import json

from pydantic import BaseModel, Field, validator

from app.enums import AssignmentStatus, AssignmentType

if TYPE_CHECKING:
    pass


# Assignment Template Schemas
class AssignmentTemplateBase(BaseModel):
    """Base schema for assignment templates."""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    instructions: Optional[str] = None
    assignment_type: AssignmentType = AssignmentType.HOMEWORK
    lesson_id: Optional[int] = None  # Can be standalone
    subject_id: int
    max_points: int = Field(default=100, ge=1, le=1000)
    estimated_duration_minutes: Optional[int] = Field(None, ge=1)
    prerequisites: Optional[str] = None
    materials_needed: Optional[str] = None
    is_exportable: bool = True
    order_in_lesson: int = 0


class AssignmentTemplateCreate(AssignmentTemplateBase):
    """Schema for creating assignment templates."""


class AssignmentTemplateUpdate(BaseModel):
    """Schema for updating assignment templates."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    instructions: Optional[str] = None
    assignment_type: Optional[AssignmentType] = None
    lesson_id: Optional[int] = None
    subject_id: Optional[int] = None
    max_points: Optional[int] = Field(None, ge=1, le=1000)
    estimated_duration_minutes: Optional[int] = Field(None, ge=1)
    prerequisites: Optional[str] = None
    materials_needed: Optional[str] = None
    is_exportable: Optional[bool] = None
    order_in_lesson: Optional[int] = None
    is_archived: Optional[bool] = None


class AssignmentTemplateResponse(AssignmentTemplateBase):
    """Schema for responding with assignment templates."""

    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    is_archived: bool

    # Computed fields
    total_assigned: int = 0  # How many students have this assigned
    average_grade: Optional[float] = None  # Average grade across all students

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# Student Assignment Schemas
class StudentAssignmentBase(BaseModel):
    """Base schema for student assignments."""

    due_date: Optional[date] = None
    custom_instructions: Optional[str] = None
    custom_max_points: Optional[int] = Field(None, ge=1, le=1000)


class StudentAssignmentCreate(StudentAssignmentBase):
    """Schema for creating student assignments."""

    template_id: int
    student_id: int


class StudentAssignmentBulkCreate(BaseModel):
    """Schema for creating student assignments in bulk."""

    template_id: int
    student_ids: List[int] = Field(..., min_items=1)
    due_date: Optional[date] = None
    custom_instructions: Optional[str] = None
    custom_max_points: Optional[int] = Field(None, ge=1, le=1000)


class StudentAssignmentUpdate(BaseModel):
    """Schema for updating student assignments."""

    due_date: Optional[date] = None
    extended_due_date: Optional[date] = None
    status: Optional[AssignmentStatus] = None
    custom_instructions: Optional[str] = None
    custom_max_points: Optional[int] = Field(None, ge=1, le=1000)
    student_notes: Optional[str] = None
    submission_notes: Optional[str] = None
    submission_artifacts: Optional[List[str]] = Field(None, description="List of external artifact links")

    @validator('submission_artifacts')
    def validate_artifact_urls(cls, v):
        """Validate that artifact links are valid URLs."""
        if v is None:
            return v
        
        import re
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        validated_urls = []
        for url in v:
            if url.strip():  # Only validate non-empty URLs
                if not url_pattern.match(url.strip()):
                    raise ValueError(f'Invalid URL format: {url}')
                validated_urls.append(url.strip())
        
        return validated_urls


class StudentAssignmentGrade(BaseModel):
    """Schema for grading student assignments."""

    points_earned: float = Field(..., ge=0)
    teacher_feedback: Optional[str] = None
    letter_grade: Optional[str] = None


class StudentAssignmentResponse(StudentAssignmentBase):
    """Schema for responding with student assignments."""

    id: int
    template_id: int
    student_id: int
    assigned_date: date
    status: AssignmentStatus
    started_date: Optional[date] = None
    completed_date: Optional[date] = None
    submitted_date: Optional[date] = None
    points_earned: Optional[float] = None
    percentage_grade: Optional[float] = None
    letter_grade: Optional[str] = None
    is_graded: bool
    graded_date: Optional[date] = None
    graded_by: Optional[int] = None
    teacher_feedback: Optional[str] = None
    student_notes: Optional[str] = None
    submission_notes: Optional[str] = None
    submission_artifacts: Optional[List[str]] = None
    time_spent_minutes: int = 0
    assigned_by: int
    created_at: datetime
    updated_at: datetime

    # Related data
    template: Optional[AssignmentTemplateResponse] = None

    # student: Optional['User'] = None  # Causes serialization issues

    @validator('submission_artifacts', pre=True)
    def parse_submission_artifacts(cls, v):
        """Parse submission_artifacts from JSON string to list."""
        if isinstance(v, str) and v:
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v or []

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# Detailed Assignment View (Template + Student Instance)
class AssignmentDetailResponse(BaseModel):
    """Schema for responding with detailed assignment information."""

    # Template information
    template: AssignmentTemplateResponse
    # Student assignment instance (if assigned to current student)
    student_assignment: Optional[StudentAssignmentResponse] = None
    # Subject information
    subject_name: str
    subject_color: str
    # Lesson context (if part of a lesson)
    lesson_name: Optional[str] = None


# Assignment Assignment (when assigning templates to students)
class AssignmentAssignmentRequest(BaseModel):
    """Schema for assigning templates to students."""

    template_id: int
    student_ids: List[int] = Field(..., min_items=1)
    due_date: Optional[date] = None
    custom_instructions: Optional[str] = None
    custom_max_points: Optional[int] = Field(None, ge=1, le=1000)


class AssignmentAssignmentResponse(BaseModel):
    """Schema for responding to assignment assignment requests."""

    success_count: int
    failed_assignments: List[dict] = []
    created_assignments: List[StudentAssignmentResponse] = []


# Progress and Analytics
class SubjectProgressResponse(BaseModel):
    """Schema for responding with subject progress."""

    subject_id: int
    subject_name: str
    subject_color: str
    total_assignments: int
    completed_assignments: int
    average_grade: Optional[float] = None
    completion_percentage: float


class StudentProgressSummary(BaseModel):
    """Schema for responding with student progress summaries."""

    student_id: int
    student_name: str
    total_assignments: int
    completed_assignments: int
    average_grade: Optional[float] = None
    subjects: List[SubjectProgressResponse] = []


# Export/Import schemas
class AssignmentTemplateExport(BaseModel):
    """Schema for exporting assignment templates."""

    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    assignment_type: str
    subject_name: str  # Export with subject name instead of ID
    max_points: int
    estimated_duration_minutes: Optional[int] = None
    prerequisites: Optional[str] = None
    materials_needed: Optional[str] = None
    export_metadata: dict = {}


class AssignmentTemplateImport(BaseModel):
    """Schema for importing assignment templates."""

    assignment_data: AssignmentTemplateExport
    target_lesson_id: Optional[int] = None  # Where to import it
    target_subject_id: Optional[int] = None  # Override subject