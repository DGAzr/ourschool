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

"""Backup schemas for system-wide backup and restore functionality."""

from datetime import date, datetime, time
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, field_validator


# Individual model backup schemas

class UserBackup(BaseModel):
    """Schema for backing up user data."""
    email: str
    username: str
    first_name: str
    last_name: str
    role: str
    is_active: bool = True
    parent_id: Optional[int] = None
    date_of_birth: Optional[date] = None
    grade_level: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class SubjectBackup(BaseModel):
    """Schema for backing up subject data."""
    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"


class AssignmentTemplateBackup(BaseModel):
    """Schema for backing up assignment template data."""
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    assignment_type: str
    subject_name: str  # Will be resolved during import
    lesson_id: Optional[int] = None  # Will be resolved during import
    max_points: int = 100
    estimated_duration_minutes: Optional[int] = None
    prerequisites: Optional[str] = None
    materials_needed: Optional[str] = None
    is_exportable: bool = True
    created_by_email: str  # User email for resolution
    created_at: datetime
    updated_at: datetime


class LessonBackup(BaseModel):
    """Schema for backing up lesson data."""
    title: str
    description: Optional[str] = None
    scheduled_date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    
    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def convert_time_to_string(cls, v):
        if v is None:
            return None
        if isinstance(v, time):
            return v.strftime('%H:%M:%S')
        return v
    estimated_duration_minutes: Optional[int] = None
    materials_needed: Optional[str] = None
    objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    resources: Optional[str] = None
    lesson_order: int = 0
    subject_names: List[str] = []
    created_at: datetime
    updated_at: datetime


class LessonAssignmentBackup(BaseModel):
    """Schema for backing up lesson-assignment relationships."""
    lesson_title: str  # For resolution
    assignment_template_name: str  # For resolution
    order_in_lesson: int = 0
    planned_duration_minutes: Optional[int] = None
    custom_instructions: Optional[str] = None
    is_required: bool = True
    custom_max_points: Optional[int] = None


class StudentAssignmentBackup(BaseModel):
    """Schema for backing up student assignment data."""
    student_email: str  # For resolution
    assignment_template_name: str  # For resolution
    due_date: Optional[date] = None
    extended_due_date: Optional[date] = None
    status: str = "not_started"
    points_earned: Optional[int] = None
    letter_grade: Optional[str] = None
    teacher_feedback: Optional[str] = None
    student_notes: Optional[str] = None
    submission_notes: Optional[str] = None
    custom_instructions: Optional[str] = None
    custom_max_points: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class TermBackup(BaseModel):
    """Schema for backing up term data."""
    name: str
    type: str
    start_date: date
    end_date: date
    is_current: bool = False
    created_at: datetime
    updated_at: datetime


class TermSubjectBackup(BaseModel):
    """Schema for backing up term-subject relationships."""
    term_name: str  # For resolution
    subject_name: str  # For resolution
    target_grade: Optional[str] = None
    weight: Optional[float] = None


class StudentTermGradeBackup(BaseModel):
    """Schema for backing up student term grades."""
    student_email: str  # For resolution
    term_name: str  # For resolution
    subject_name: str  # For resolution
    grade: Optional[str] = None
    points_earned: Optional[int] = None
    points_possible: Optional[int] = None
    percentage: Optional[float] = None
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class GradeHistoryBackup(BaseModel):
    """Schema for backing up grade history."""
    student_email: str  # For resolution
    term_name: str  # For resolution
    subject_name: str  # For resolution
    grade: str
    points_earned: int
    points_possible: int
    percentage: float
    recorded_at: datetime


class AttendanceRecordBackup(BaseModel):
    """Schema for backing up attendance records."""
    student_email: str  # For resolution
    date: date
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class JournalEntryBackup(BaseModel):
    """Schema for backing up journal entries."""
    user_email: str  # For resolution
    title: str
    content: str
    date: date
    is_private: bool = False
    created_at: datetime
    updated_at: datetime


# Complete system backup schema

class SystemBackup(BaseModel):
    """Complete system backup schema containing all data."""
    
    # Metadata
    format_version: str = "1.0"
    backup_timestamp: datetime
    created_by: str
    system_info: Dict[str, Any] = {}
    
    # Core data (order matters for import)
    users: List[UserBackup] = []
    subjects: List[SubjectBackup] = []
    terms: List[TermBackup] = []
    lessons: List[LessonBackup] = []
    assignment_templates: List[AssignmentTemplateBackup] = []
    lesson_assignments: List[LessonAssignmentBackup] = []
    term_subjects: List[TermSubjectBackup] = []
    
    # Dependent data
    student_assignments: List[StudentAssignmentBackup] = []
    student_term_grades: List[StudentTermGradeBackup] = []
    grade_history: List[GradeHistoryBackup] = []
    attendance_records: List[AttendanceRecordBackup] = []
    journal_entries: List[JournalEntryBackup] = []
    
    # Import statistics
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }


class SystemBackupImportRequest(BaseModel):
    """Request schema for importing system backup."""
    backup_data: SystemBackup
    import_options: Dict[str, Any] = Field(default_factory=lambda: {
        "skip_existing_users": True,
        "update_existing_data": False,
        "preserve_ids": False,
        "dry_run": False
    })


class SystemBackupImportResult(BaseModel):
    """Result schema for system backup import."""
    success: bool
    dry_run: bool = False
    
    # Statistics
    imported_counts: Dict[str, int] = {}
    skipped_counts: Dict[str, int] = {}
    updated_counts: Dict[str, int] = {}
    error_counts: Dict[str, int] = {}
    
    # Details
    warnings: List[str] = []
    errors: List[str] = []
    import_log: List[str] = []
    
    # Mapping information for reference
    id_mappings: Dict[str, Dict[str, int]] = {}  # old_identifier -> new_id