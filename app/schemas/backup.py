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

from datetime import date, datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

# Individual model backup schemas


class UserBackup(BaseModel):
    """Schema for backing up user data."""

    external_id: Optional[str] = (
        None  # Stable cross-version identity (added format 2.0)
    )
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

    external_id: Optional[str] = (
        None  # Stable cross-version identity (added format 2.0)
    )
    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"
    icon: Optional[str] = None


class AssignmentTemplateBackup(BaseModel):
    """Schema for backing up assignment template data."""

    external_id: Optional[str] = (
        None  # Stable cross-version identity (added format 2.0)
    )
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    assignment_type: str
    subject_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    subject_name: str  # Fallback resolution key (all versions)
    icon: Optional[str] = None
    max_points: int = 100
    estimated_duration_minutes: Optional[int] = None
    prerequisites: Optional[str] = None
    materials_needed: Optional[str] = None
    is_exportable: bool = True
    created_by_email: str  # User email for resolution
    created_at: datetime
    updated_at: datetime


class StudentAssignmentBackup(BaseModel):
    """Schema for backing up student assignment data."""

    student_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    student_email: str  # Fallback resolution key
    template_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    assignment_template_name: str  # Fallback resolution key
    due_date: Optional[date] = None
    extended_due_date: Optional[date] = None
    status: str = "not_started"
    # Float to match the model column; an int here truncates decimal scores.
    points_earned: Optional[float] = None
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

    external_id: Optional[str] = (
        None  # Stable cross-version identity (added format 2.0)
    )
    name: str
    type: str
    academic_year: Optional[str] = None  # Added format 2.0; derived on import if absent
    start_date: date
    end_date: date
    is_current: bool = False
    created_at: datetime
    updated_at: datetime


class TermSubjectBackup(BaseModel):
    """Schema for backing up term-subject relationships."""

    term_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    term_name: str  # Fallback resolution key
    subject_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    subject_name: str  # Fallback resolution key
    target_grade: Optional[str] = None
    weight: Optional[float] = None


class StudentTermGradeBackup(BaseModel):
    """Schema for backing up student term grades."""

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    term_external_id: Optional[str] = None
    term_name: str  # Fallback resolution key
    subject_external_id: Optional[str] = None
    subject_name: str  # Fallback resolution key
    current_points_earned: float = 0.0
    current_points_possible: float = 0.0
    current_percentage: Optional[float] = None
    current_letter_grade: Optional[str] = None
    final_points_earned: Optional[float] = None
    final_points_possible: Optional[float] = None
    final_percentage: Optional[float] = None
    final_letter_grade: Optional[str] = None
    is_finalized: bool = False
    assignments_completed: int = 0
    assignments_total: int = 0
    progress_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class GradeHistoryBackup(BaseModel):
    """Schema for backing up grade history audit entries."""

    student_email: str  # For reference (import is skipped — audit data only)
    term_name: str
    subject_name: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    changed_at: datetime


class SystemSettingsBackup(BaseModel):
    """Schema for backing up system settings."""

    setting_key: str
    setting_value: str
    setting_type: str
    description: Optional[str] = None
    is_active: bool = True


class AttendanceRecordBackup(BaseModel):
    """Schema for backing up attendance records."""

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    date: date
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class JournalEntryBackup(BaseModel):
    """Schema for backing up journal entries."""

    user_external_id: Optional[str] = None
    user_email: str  # Fallback resolution key
    title: str
    content: str
    date: date
    is_private: bool = False
    created_at: datetime
    updated_at: datetime


class StudentPointsBackup(BaseModel):
    """Schema for backing up student point balances."""

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    current_balance: int = 0
    total_earned: int = 0
    total_spent: int = 0
    created_at: datetime
    updated_at: datetime


class PointTransactionBackup(BaseModel):
    """Schema for backing up individual point transactions."""

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    amount: int
    transaction_type: str
    source_description: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


# Complete system backup schema


class SystemBackup(BaseModel):
    """Complete system backup schema containing all data."""

    # Metadata
    format_version: str = "2.0"
    backup_timestamp: datetime
    created_by: str
    system_info: Dict[str, Any] = {}

    # Core data (order matters for import)
    users: List[UserBackup] = []
    subjects: List[SubjectBackup] = []
    terms: List[TermBackup] = []
    assignment_templates: List[AssignmentTemplateBackup] = []
    term_subjects: List[TermSubjectBackup] = []

    # Dependent data
    student_assignments: List[StudentAssignmentBackup] = []
    student_term_grades: List[StudentTermGradeBackup] = []
    grade_history: List[GradeHistoryBackup] = []
    attendance_records: List[AttendanceRecordBackup] = []
    journal_entries: List[JournalEntryBackup] = []
    student_points: List[StudentPointsBackup] = []
    point_transactions: List[PointTransactionBackup] = []
    system_settings: List[SystemSettingsBackup] = []

    # Import statistics
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
        }


class SystemBackupImportRequest(BaseModel):
    """Request schema for importing system backup."""

    backup_data: SystemBackup
    import_options: Dict[str, Any] = Field(
        default_factory=lambda: {
            "skip_existing_users": True,
            "update_existing_data": False,
            "preserve_ids": False,
            "dry_run": False,
        }
    )


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
