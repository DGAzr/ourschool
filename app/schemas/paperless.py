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
from typing import Dict, List, Optional, Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, Field, field_validator, model_validator

from app.enums import MaterialKind

_VALID_KINDS = {kind.value for kind in MaterialKind}


# --- Connection ---
class PaperlessCredentials(BaseModel):
    """Body for /test and /connect."""

    url: str = Field(..., min_length=1, max_length=500)
    token: str = Field(..., min_length=1, max_length=500)

    @field_validator("url")
    @classmethod
    def normalize_url(cls, value: str) -> str:
        parts = urlsplit(value.strip())
        if (
            parts.scheme not in {"http", "https"}
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
        ):
            raise ValueError(
                "Use an HTTP(S) server URL without credentials, query, or fragment"
            )
        return urlunsplit(
            (parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), "", "")
        )


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
    api_version: int = 10
    server_version: Optional[str] = None
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
    scope_mode: Literal["all", "selected"]
    library_id: Optional[str] = None

    @model_validator(mode="after")
    def check_scope(self):
        if self.scope_mode == "selected" and not (
            self.scope_tag_ids or self.scope_doctype_ids
        ):
            raise ValueError(
                "Select at least one tag or document type, or explicitly choose the entire library"
            )
        if self.scope_mode == "all" and (self.scope_tag_ids or self.scope_doctype_ids):
            raise ValueError("Entire-library scope cannot include selected filters")
        return self


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
    configured: bool
    in_scope: bool

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class DoctypeMapResponse(BaseModel):
    """One Paperless document type → material kind mapping row."""

    paperless_doctype_id: int
    paperless_doctype_name: str
    material_kind: str
    configured: bool
    in_scope: bool

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class PaperlessJobResponse(BaseModel):
    id: str
    library_id: str
    state: str
    phase: str
    processed: int
    counts: dict = {}
    attempt: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None

    model_config = {"from_attributes": True}


class PaperlessLibraryResponse(BaseModel):
    id: str
    url: Optional[str] = None
    model_config = {"from_attributes": True}


class PaperlessStatusResponse(BaseModel):
    """Connection status + mappings (drives the whole Settings screen)."""

    connected: bool
    library_id: Optional[str] = None
    libraries: List[PaperlessLibraryResponse] = []
    cache_available: bool = False
    sync_interval_minutes: int = 15
    api_version: int = 10
    next_sync_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    active_job: Optional[PaperlessJobResponse] = None
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
    mapping_options_ready: bool = False
    # Scoped candidates plus explicitly configured, possibly inactive rows.
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

    sync_interval_minutes: Optional[int] = Field(None, ge=5, le=1440)
    auto_import: Optional[bool] = None
    index_ocr: Optional[bool] = None
    mapped_only: Optional[bool] = None
    # None = unchanged, [] = clear that axis. Takes effect on the next sync.
    scope_tag_ids: Optional[List[int]] = None
    scope_doctype_ids: Optional[List[int]] = None
    tag_maps: Optional[List[TagMapUpdate]] = None
    doctype_maps: Optional[List[DoctypeMapUpdate]] = None
    remove_tag_map_ids: List[int] = []
    remove_doctype_map_ids: List[int] = []

    @model_validator(mode="after")
    def validate_mapping_changes(self):
        for changes, removals, identity in (
            (self.tag_maps or [], self.remove_tag_map_ids, "paperless_tag_id"),
            (
                self.doctype_maps or [],
                self.remove_doctype_map_ids,
                "paperless_doctype_id",
            ),
        ):
            ids = [getattr(change, identity) for change in changes]
            if len(ids) != len(set(ids)) or len(removals) != len(set(removals)):
                raise ValueError("Mapping IDs must not be duplicated")
            if set(ids) & set(removals):
                raise ValueError("A mapping cannot be edited and removed together")
        return self


class PaperlessConnectResponse(BaseModel):
    status: PaperlessStatusResponse
    job: PaperlessJobResponse


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
    paperless_modified: Optional[datetime] = None
    used_in_count: int = 0
    # Present only when the list was ranked against a lesson (lesson_id param).
    match_reasons: List[str] = []
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


class DocumentAssignmentUsage(BaseModel):
    """One direct attachment to a student's assignment instance."""

    assignment_id: int
    student_name: str
    assignment_title: str


class PaperlessDocumentAvailability(BaseModel):
    """Content availability without server identity or credential information."""

    available: bool
    reason: Optional[str] = None


class PaperlessDocumentDetail(PaperlessDocumentItem):
    """Document detail: item fields + where it is used."""

    used_in: List[DocumentLessonUsage] = []
    used_in_templates: List[DocumentTemplateUsage] = []
    used_in_assignments: List[DocumentAssignmentUsage] = []


# --- Attachments ---
class PaperlessAttachRequest(BaseModel):
    """Attach one cached document (by cache PK) to a lesson/template."""

    document_id: int


class PaperlessBatchAttachRequest(BaseModel):
    document_ids: List[int] = Field(..., min_length=1, max_length=100)


class PaperlessMaterialResponse(BaseModel):
    """An attached document link with snapshotted display fields.

    ``external_id`` (the authenticated thumbnail identifier) is resolved from the
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
