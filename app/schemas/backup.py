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

DateType = date

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
    grade_level: Optional[int] = Field(None, ge=0, le=12)
    theme_preference: Optional[str] = None
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
    is_library: bool = True
    created_by_email: str  # User email for resolution
    created_at: datetime
    updated_at: datetime


class StudentAssignmentBackup(BaseModel):
    """Schema for backing up student assignment data."""

    student_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    student_email: str  # Fallback resolution key
    template_external_id: Optional[str] = None  # Preferred resolution key (format 2.0)
    assignment_template_name: str  # Fallback resolution key
    assigned_date: Optional[date] = None
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
    time_spent_minutes: int = 0
    is_student_created: bool = False
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AssignmentTimeEntryBackup(BaseModel):
    """Schema for preserving assignment work-session history."""

    student_external_id: Optional[str] = None
    student_email: str
    template_external_id: Optional[str] = None
    assignment_template_name: str
    assignment_due_date: Optional[date] = None
    logged_by_external_id: Optional[str] = None
    logged_by_email: Optional[str] = None
    work_date: date
    minutes: int
    note: Optional[str] = None
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
    student_external_id: Optional[str] = None
    student_email: Optional[str] = None
    title: str
    content: str
    date: date
    is_private: bool = False
    mood: Optional[str] = None
    icon: Optional[str] = None
    tags: Optional[List[str]] = None
    win: Optional[str] = None
    goals: Optional[List[Dict[str, Any]]] = None
    reactions: Optional[List[str]] = None
    needs_response: bool = True
    points_awarded: Optional[int] = None
    edited_at: Optional[datetime] = None
    edited_by_external_id: Optional[str] = None
    edited_by_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class StudentPointsBackup(BaseModel):
    """Schema for backing up student point balances."""

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    current_balance: int = 0
    total_earned: int = 0
    total_spent: int = 0
    # Shop item the student is saving toward, by external_id (remapped on
    # import; a missing item just clears the goal). Optional: old backups
    # predate the field.
    goal_item_external_id: Optional[str] = None
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


# Points Shop backup schemas


class ShopCategoryBackup(BaseModel):
    """Schema for backing up shop categories."""

    external_id: str
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    created_at: datetime


class ShopImageBackup(BaseModel):
    """Schema for backing up shop images.

    Image bytes are base64-encoded (``data_b64``) so the backup stays JSON-safe.
    Note: this inflates the backup by ~33% per image — fine at hundreds of
    images; revisit if catalogs grow large.
    """

    external_id: str
    mime_type: str
    size_bytes: int
    data_b64: str
    created_at: datetime


class ShopItemBackup(BaseModel):
    """Schema for backing up shop items (category resolved by external_id)."""

    external_id: str
    name: str
    category_external_id: str
    description: Optional[str] = None
    cost_points: int
    quantity_available: Optional[int] = None
    fulfillment_type: str
    is_active: bool = True
    display_order: int = 0  # Optional default: old backups predate the field
    image_ids: List[str] = []
    total_redeemed: int = 0
    created_at: datetime
    updated_at: datetime


class ShopRedemptionBackup(BaseModel):
    """Schema for backing up shop redemptions.

    The item is resolved by external_id on restore (optional — a deleted item
    just leaves item_id NULL, and the snapshot fields preserve display).
    Transaction-link FKs (point_transaction_id, refund_transaction_id) and
    decided_by are intentionally dropped on restore: point transactions carry
    no stable external id, so those links can't be rebuilt. Ledger totals still
    restore correctly via student_points + point_transactions.
    """

    external_id: str
    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    item_external_id: Optional[str] = None
    item_name: str
    cost_points: int
    fulfillment_type: str
    status: str
    created_at: datetime
    decided_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None


# Lesson Planner backup schemas


class LessonStudentRefBackup(BaseModel):
    """A student a lesson is planned for (resolution: external_id > email)."""

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key


class LessonTemplateLinkBackup(BaseModel):
    """Schema for backing up a lesson's linked assignment template.

    The template is resolved by external_id (name fallback) on restore. An
    unresolvable template leaves the link with template_id NULL, matching the
    model's SET NULL contract for deleted templates.
    """

    template_external_id: Optional[str] = None
    template_name: str  # Fallback resolution key
    custom_due_date: Optional[date] = None
    custom_max_points: Optional[int] = None
    custom_instructions: Optional[str] = None


class LessonMaterialBackup(BaseModel):
    """Schema for backing up a lesson material (owned child, no FKs to remap)."""

    label: str
    is_gathered: bool = False
    position: int = 0


class LessonResourceBackup(BaseModel):
    """Schema for backing up a lesson resource link (owned child)."""

    label: str
    url: Optional[str] = None
    position: int = 0


class LessonBackup(BaseModel):
    """Schema for backing up lessons with their nested children.

    Subject and creator are resolved on restore like other sections
    (external_id, then natural key); both are SET NULL FKs on the model, so
    unresolvable references degrade to an un-linked lesson rather than a skip.
    """

    external_id: str
    date: Optional[DateType] = None
    last_scheduled_date: Optional[DateType] = None
    title: str
    objective: Optional[str] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    position: int = 0  # 0-based rank within the lesson's date (board ordering)
    status: str
    subject_external_id: Optional[str] = None
    subject_name: Optional[str] = None  # Fallback resolution key
    created_by_external_id: Optional[str] = None
    created_by_email: Optional[str] = None  # Fallback resolution key
    students: List[LessonStudentRefBackup] = []
    templates: List[LessonTemplateLinkBackup] = []
    materials: List[LessonMaterialBackup] = []
    resources: List[LessonResourceBackup] = []
    created_at: datetime
    updated_at: datetime


# Paperless-NGX integration backup schemas
#
# The connection row (URL + Fernet-encrypted API token) is deliberately NOT
# backed up: the token only decrypts under the SECRET_KEY that encrypted it,
# so it cannot restore across installs — reconnecting is the supported path.
# Thumbnails are a lazily re-fetched cache and are also excluded. Everything
# else (mappings, the document metadata cache, and the three attachment link
# tables) IS backed up so manual mapping work and lesson/template/assignment
# attachments survive a wipe-and-restore.


class PaperlessTagMapBackup(BaseModel):
    """Schema for backing up a Paperless tag → subject mapping."""

    paperless_tag_id: int
    paperless_tag_name: str
    subject_external_id: Optional[str] = None
    subject_name: Optional[str] = None  # Fallback resolution key
    auto_matched: bool = True


class PaperlessDoctypeMapBackup(BaseModel):
    """Schema for backing up a Paperless document type → material kind mapping."""

    paperless_doctype_id: int
    paperless_doctype_name: str
    material_kind: str


class PaperlessDocumentBackup(BaseModel):
    """Schema for backing up one cached Paperless document's metadata.

    ``paperless_id`` is the stable identity (unique per server); ``external_id``
    is preserved so thumbnail capability URLs keep working after restore.
    """

    external_id: str
    paperless_id: int
    asn: Optional[str] = None
    title: str
    correspondent: Optional[str] = None
    paperless_doctype_id: Optional[int] = None
    material_kind: str
    subject_external_id: Optional[str] = None
    subject_name: Optional[str] = None  # Fallback resolution key
    tag_ids: List[int] = []
    page_count: Optional[int] = None
    paperless_created: Optional[datetime] = None
    paperless_added: Optional[datetime] = None
    paperless_modified: Optional[datetime] = None
    keywords: Optional[str] = None
    present: bool = True
    synced_at: Optional[datetime] = None


class PaperlessAttachmentBackupBase(BaseModel):
    """Snapshot fields shared by every Paperless attachment link.

    Mirrors ``app.models.paperless.snapshot_fields`` so restored links render
    identically to the originals even before the next sync.
    """

    document_paperless_id: int
    title: str
    asn: Optional[str] = None
    material_kind: str
    subject_external_id: Optional[str] = None
    subject_name: Optional[str] = None  # Fallback resolution key
    page_count: Optional[int] = None
    correspondent: Optional[str] = None
    created_at: datetime


class LessonPaperlessMaterialBackup(PaperlessAttachmentBackupBase):
    """A Paperless document attached to a lesson (lesson resolved by external_id)."""

    lesson_external_id: str


class TemplatePaperlessMaterialBackup(PaperlessAttachmentBackupBase):
    """A Paperless document attached to an assignment template."""

    template_external_id: Optional[str] = None
    template_name: str  # Fallback resolution key


class StudentAssignmentPaperlessMaterialBackup(PaperlessAttachmentBackupBase):
    """A one-off Paperless document attached to a single assignment instance.

    StudentAssignments carry no external_id; identity uses the same
    (student, template, due_date) triple the assignment importer dedupes on.
    """

    student_external_id: Optional[str] = None
    student_email: str  # Fallback resolution key
    template_external_id: Optional[str] = None
    assignment_template_name: str  # Fallback resolution key
    due_date: Optional[date] = None


# Complete system backup schema


class SystemBackup(BaseModel):
    """Complete system backup schema containing all data."""

    # Metadata
    format_version: str = "2.2"
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
    assignment_time_entries: List[AssignmentTimeEntryBackup] = []
    student_term_grades: List[StudentTermGradeBackup] = []
    grade_history: List[GradeHistoryBackup] = []
    attendance_records: List[AttendanceRecordBackup] = []
    journal_entries: List[JournalEntryBackup] = []
    student_points: List[StudentPointsBackup] = []
    point_transactions: List[PointTransactionBackup] = []
    shop_categories: List[ShopCategoryBackup] = []
    shop_images: List[ShopImageBackup] = []
    shop_items: List[ShopItemBackup] = []
    shop_redemptions: List[ShopRedemptionBackup] = []
    lessons: List[LessonBackup] = []
    # Paperless-NGX (mappings, document metadata cache, attachment links;
    # never the connection/token — see the schema comments above).
    paperless_tag_maps: List[PaperlessTagMapBackup] = []
    paperless_doctype_maps: List[PaperlessDoctypeMapBackup] = []
    paperless_documents: List[PaperlessDocumentBackup] = []
    lesson_paperless_materials: List[LessonPaperlessMaterialBackup] = []
    template_paperless_materials: List[TemplatePaperlessMaterialBackup] = []
    student_assignment_paperless_materials: List[
        StudentAssignmentPaperlessMaterialBackup
    ] = []
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
    # Required (must equal WIPE_CONFIRMATION_PHRASE) when import_options
    # includes wipe_before_import=true. Kept top-level, not in import_options:
    # it is a safety credential, not a tuning knob.
    wipe_confirmation: Optional[str] = None


class SystemBackupImportResult(BaseModel):
    """Result schema for system backup import."""

    success: bool
    dry_run: bool = False

    # Statistics
    imported_counts: Dict[str, int] = {}
    skipped_counts: Dict[str, int] = {}
    updated_counts: Dict[str, int] = {}
    error_counts: Dict[str, int] = {}
    # Rows removed by wipe_before_import (would-be-removed counts on dry_run)
    deleted_counts: Dict[str, int] = {}

    # Details
    warnings: List[str] = []
    errors: List[str] = []
    import_log: List[str] = []

    # Mapping information for reference
    id_mappings: Dict[str, Dict[str, int]] = {}  # old_identifier -> new_id
