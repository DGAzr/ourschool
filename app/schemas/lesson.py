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

"""Lesson planning schemas."""

from datetime import date as date_type, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.enums import LessonStatus
from app.schemas.paperless import PaperlessMaterialResponse


# --- Child inputs (write) ---
class LessonMaterialInput(BaseModel):
    """A material to gather, as sent by the editor. Position = list order."""

    label: str = Field(..., min_length=1, max_length=200)
    is_gathered: bool = False


class LessonResourceInput(BaseModel):
    """A resource link, as sent by the editor. Position = list order."""

    label: str = Field(..., min_length=1, max_length=200)
    url: Optional[str] = Field(default=None, max_length=2000)


# --- Child responses (read) ---
class LessonMaterialResponse(BaseModel):
    """A material row."""

    id: int
    label: str
    is_gathered: bool
    position: int

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonResourceResponse(BaseModel):
    """A resource row."""

    id: int
    label: str
    url: Optional[str] = None
    position: int

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonStudentSummary(BaseModel):
    """A minimal student projection for lesson cards/avatars."""

    id: int
    first_name: str
    last_name: str
    username: str

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonSubjectSummary(BaseModel):
    """A minimal subject projection (drives lesson coloring)."""

    id: int
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonTemplateSummary(BaseModel):
    """A minimal template projection for the linked-assignment chip."""

    id: int
    name: str
    assignment_type: str
    max_points: int
    estimated_duration_minutes: Optional[int] = None
    subject_id: int

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonTemplateLinkInput(BaseModel):
    """One linked template on a lesson, with optional per-link overrides."""

    template_id: int
    custom_due_date: Optional[date_type] = None
    custom_max_points: Optional[int] = Field(default=None, ge=1, le=1000)
    custom_instructions: Optional[str] = None


class LessonTemplateLinkResponse(BaseModel):
    """A linked template as returned: link id, overrides, and template details."""

    id: int
    template_id: Optional[int] = None
    custom_due_date: Optional[date_type] = None
    custom_max_points: Optional[int] = None
    custom_instructions: Optional[str] = None
    template: Optional[LessonTemplateSummary] = None

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# --- Lesson write schemas ---
class LessonBase(BaseModel):
    """Fields shared by create/update."""

    title: str = Field(..., min_length=1, max_length=200)
    date: Optional[date_type] = None
    subject_id: Optional[int] = None
    objective: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None
    status: LessonStatus = LessonStatus.PLANNED


class LessonCreate(LessonBase):
    """Create payload. Nested lists are position-ordered by list order."""

    student_ids: List[int] = []
    templates: List[LessonTemplateLinkInput] = []
    materials: List[LessonMaterialInput] = []
    resources: List[LessonResourceInput] = []


class LessonUpdate(BaseModel):
    """Update payload. All optional; nested lists = full replace when provided."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[date_type] = None
    subject_id: Optional[int] = None
    objective: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None
    status: Optional[LessonStatus] = None
    student_ids: Optional[List[int]] = None
    templates: Optional[List[LessonTemplateLinkInput]] = None
    materials: Optional[List[LessonMaterialInput]] = None
    resources: Optional[List[LessonResourceInput]] = None


class LessonMaterialToggle(BaseModel):
    """PATCH body for the Teach-mode material checkbox."""

    is_gathered: bool


class LessonStatusUpdate(BaseModel):
    """PATCH body for the mark-taught toggle."""

    status: LessonStatus


class LessonReorderInput(BaseModel):
    """PATCH body for drag-and-drop reorder.

    ``lesson_ids`` is the full, final top-to-bottom order of the lessons that
    belong to ``date`` after the drop. Any listed lesson currently on a
    different date is moved to ``date`` (a cross-day drag).
    """

    date: Optional[date_type] = None
    lesson_ids: List[int]


class LessonRolloverInput(BaseModel):
    """Browser-local school date used as the overdue cutoff."""

    current_date: date_type


# --- Lesson response ---
class StudentLessonResponse(BaseModel):
    """Student-safe lesson projection for the "my lessons" schedule view.

    Deliberately excludes teacher-private fields: ``notes``, ``created_by``,
    the ``students`` roster, and the physical ``materials`` gather list.
    """

    id: int
    title: str
    date: date_type
    objective: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: LessonStatus
    position: int

    subject: Optional[LessonSubjectSummary] = None
    templates: List[LessonTemplateLinkResponse] = []
    resources: List[LessonResourceResponse] = []
    paperless_materials: List[PaperlessMaterialResponse] = []

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonResponse(LessonBase):
    """Full lesson projection with nested relations."""

    id: int
    external_id: str
    position: int
    last_scheduled_date: Optional[date_type] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    subject: Optional[LessonSubjectSummary] = None
    templates: List[LessonTemplateLinkResponse] = []
    students: List[LessonStudentSummary] = []
    materials: List[LessonMaterialResponse] = []
    resources: List[LessonResourceResponse] = []
    # Paperless-NGX documents attached to this lesson (distinct from the
    # physical ``materials`` gather list above).
    paperless_materials: List[PaperlessMaterialResponse] = []

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class LessonWriteResponse(BaseModel):
    """Create/update result: the lesson plus any user-facing sync warnings."""

    lesson: LessonResponse
    warnings: List[str] = []


class LessonReorderResponse(BaseModel):
    """Reorder result: the affected day's lessons (new order) plus warnings."""

    lessons: List[LessonResponse] = []
    warnings: List[str] = []


class LessonRolloverResponse(BaseModel):
    """Overdue reconciliation result and canonical drawer contents."""

    moved_count: int = 0
    lessons: List[LessonResponse] = []
    warnings: List[str] = []


class LessonDeleteResponse(BaseModel):
    """Delete result: a message plus any user-facing sync warnings."""

    message: str
    warnings: List[str] = []
