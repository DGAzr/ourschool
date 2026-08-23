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

"""Paperless-NGX integration schemas."""

from datetime import date as date_type, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.enums import MaterialKind

_VALID_KINDS = {kind.value for kind in MaterialKind}


# --- Connection ---
class PaperlessCredentials(BaseModel):
    """Body for /test and /connect."""

    url: str = Field(..., min_length=1, max_length=500)
    token: str = Field(..., min_length=1, max_length=500)


class PaperlessScopeOption(BaseModel):
    """One Paperless tag or document type offered in the sync-scope picker."""

    id: int
    name: str
    document_count: int = 0


class PaperlessTestResponse(BaseModel):
    """Result of a successful credential test.

    Carries the full tag/doctype lists so the connect card can offer the
    sync-scope picker before anything is saved.
    """

    ok: bool = True
    document_count: int
    tag_count: int
    document_type_count: int
    tags: List[PaperlessScopeOption] = []
    document_types: List[PaperlessScopeOption] = []


class PaperlessConnectRequest(PaperlessCredentials):
    """Body for /connect: credentials + initial sync scope.

    Union semantics: a document syncs when it has any scoped tag OR a scoped
    doctype. Empty on both axes = sync the whole library.
    """

    scope_tag_ids: List[int] = []
    scope_doctype_ids: List[int] = []


class PaperlessScopeOptionsResponse(BaseModel):
    """Tag/doctype lists for the scope card on the connected settings page."""

    tags: List[PaperlessScopeOption] = []
    document_types: List[PaperlessScopeOption] = []


class TagMapResponse(BaseModel):
    """One Paperless tag → subject mapping row."""

    paperless_tag_id: int
    paperless_tag_name: str
    subject_id: Optional[int] = None
    auto_matched: bool

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class DoctypeMapResponse(BaseModel):
    """One Paperless document type → material kind mapping row."""

    paperless_doctype_id: int
    paperless_doctype_name: str
    material_kind: str

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class PaperlessStatusResponse(BaseModel):
    """Connection status + mappings (drives the whole Settings screen)."""

    connected: bool
    # "Reconnect required": a connection row exists but its token can no
    # longer be decrypted (SECRET_KEY rotated).
    needs_reconnect: bool = False
    url: Optional[str] = None
    token_masked: Optional[str] = None
    auto_import: bool = True
    index_ocr: bool = True
    mapped_only: bool = False
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    last_sync_error: Optional[str] = None
    document_count: int = 0
    tag_count: int = 0
    doctype_count: int = 0
    mapped_subject_count: int = 0
    scope_tag_ids: List[int] = []
    scope_doctype_ids: List[int] = []
    # Filtered to the sync scope (per non-empty axis) so the mapping cards
    # only show rows the teacher opted into.
    tag_maps: List[TagMapResponse] = []
    doctype_maps: List[DoctypeMapResponse] = []


class TagMapUpdate(BaseModel):
    """Remap one tag (null subject_id = unmapped)."""

    paperless_tag_id: int
    subject_id: Optional[int] = None


class DoctypeMapUpdate(BaseModel):
    """Remap one document type."""

    paperless_doctype_id: int
    material_kind: str

    @field_validator("material_kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        if v not in _VALID_KINDS:
            raise ValueError(f"material_kind must be one of {sorted(_VALID_KINDS)}")
        return v


class PaperlessSettingsUpdate(BaseModel):
    """Partial settings PATCH: toggles and/or mapping changes."""

    auto_import: Optional[bool] = None
    index_ocr: Optional[bool] = None
    mapped_only: Optional[bool] = None
    # None = unchanged, [] = clear that axis. Takes effect on the next sync.
    scope_tag_ids: Optional[List[int]] = None
    scope_doctype_ids: Optional[List[int]] = None
    tag_maps: Optional[List[TagMapUpdate]] = None
    doctype_maps: Optional[List[DoctypeMapUpdate]] = None


class PaperlessSyncResponse(BaseModel):
    """Result of a manual sync."""

    document_count: int
    tag_count: int
    doctype_count: int
    # Absent, unattached documents hard-deleted by the post-sync cleanup.
    purged_count: int = 0
    # True when the listing hit the client's page cap; absence detection and
    # cleanup were skipped and last_sync_status is "partial".
    truncated: bool = False
    last_sync_at: datetime
    duration_ms: int


# --- Documents ---
class PaperlessDocumentItem(BaseModel):
    """One cached document as shown in grids/pickers."""

    id: int
    external_id: str
    paperless_id: int
    asn: Optional[str] = None
    title: str
    correspondent: Optional[str] = None
    material_kind: str
    subject_id: Optional[int] = None
    page_count: Optional[int] = None
    paperless_added: Optional[datetime] = None
    used_in_count: int = 0
    # Present only when the list was ranked against a lesson (lesson_id param).
    match_pct: Optional[int] = None
    attached: Optional[bool] = None

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class PaperlessDocumentFacets(BaseModel):
    """Counts for the facet rail (keyed by kind value / subject id)."""

    kinds: Dict[str, int] = {}
    subjects: Dict[str, int] = {}


class PaperlessDocumentListResponse(BaseModel):
    """Filtered document list + facet counts."""

    total: int
    items: List[PaperlessDocumentItem] = []
    facets: PaperlessDocumentFacets = PaperlessDocumentFacets()


class DocumentLessonUsage(BaseModel):
    """One lesson a document is attached to."""

    lesson_id: int
    lesson_title: str
    subject_id: Optional[int] = None
    date: Optional[date_type] = None


class DocumentTemplateUsage(BaseModel):
    """One assignment template a document is attached to."""

    template_id: int
    template_name: str


class PaperlessDocumentDetail(PaperlessDocumentItem):
    """Document detail: item fields + where it is used."""

    used_in: List[DocumentLessonUsage] = []
    used_in_templates: List[DocumentTemplateUsage] = []


# --- Attachments ---
class PaperlessAttachRequest(BaseModel):
    """Attach one cached document (by cache PK) to a lesson/template."""

    document_id: int


class PaperlessMaterialResponse(BaseModel):
    """An attached document link with snapshotted display fields.

    ``external_id`` (the thumbnail capability id) is resolved from the
    linked document via a model property.
    """

    id: int
    document_id: int
    external_id: Optional[str] = None
    title: str
    asn: Optional[str] = None
    material_kind: str
    subject_id: Optional[int] = None
    page_count: Optional[int] = None
    correspondent: Optional[str] = None

    class Config:
        """Pydantic configuration."""

        from_attributes = True
