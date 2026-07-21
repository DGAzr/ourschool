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

"""Paperless-NGX integration models.

OurSchool keeps a **local metadata cache** of a self-hosted Paperless-NGX
library: a synchronous sync (``app/services/paperless_sync.py``) pulls tags,
document types and document metadata into the tables below so browsing,
faceting, search and objective-match ranking never need a live round-trip.
Thumbnails are fetched lazily and cached as bytea (mirroring the
``shop_images`` seam); full document content is always streamed live and
never stored.

Deliberately distinct from ``LessonMaterial`` (the physical gather-checklist
on a lesson): Paperless attachments are ``LessonPaperlessMaterial`` /
``TemplatePaperlessMaterial`` link rows that snapshot display fields, so
attached documents keep rendering even if the cache row's subject vanishes
or the server is disconnected (disconnect keeps cache + attachments by
design).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.enums import MaterialKind


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PaperlessConnection(Base):
    """The (single) configured Paperless-NGX server connection.

    Enforced single-row by convention: the service layer always reads the
    first row and ``connect`` upserts it. The API token is Fernet-encrypted
    (``app/core/crypto.py``); rotating SECRET_KEY therefore invalidates it
    and the status endpoint degrades to "disconnected — reconnect required".
    """

    __tablename__ = "paperless_connection"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    token_encrypted = Column(Text, nullable=False)

    # Sync options (Settings → Sync options card).
    auto_import = Column(Boolean, default=True, nullable=False)
    index_ocr = Column(Boolean, default=True, nullable=False)
    mapped_only = Column(Boolean, default=False, nullable=False)

    # Sync scope: a document syncs when it carries ANY of these tag ids OR
    # its doctype is one of these ids (union). None/[] on both axes = the
    # whole library. Always assign fresh lists (plain JSON, no MutableList).
    scope_tag_ids = Column(JSON, nullable=True)
    scope_doctype_ids = Column(JSON, nullable=True)

    last_sync_at = Column(DateTime(timezone=True))
    last_sync_status = Column(String(20))  # "ok" | "error"
    last_sync_error = Column(Text)

    # Server-side counts captured at last sync (status card / verified banner).
    document_count = Column(Integer, default=0, nullable=False)
    tag_count = Column(Integer, default=0, nullable=False)
    doctype_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class PaperlessTagMap(Base):
    """Maps a Paperless tag onto an OurSchool subject.

    ``subject_id`` is NULL for unmapped tags. ``auto_matched`` flips to False
    the first time the teacher remaps manually; sync never overwrites manual
    mappings.
    """

    __tablename__ = "paperless_tag_subject_map"

    id = Column(Integer, primary_key=True, index=True)
    paperless_tag_id = Column(Integer, unique=True, nullable=False)
    paperless_tag_name = Column(String(200), nullable=False)
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    auto_matched = Column(Boolean, default=True, nullable=False)

    subject = relationship("Subject", lazy="selectin")


class PaperlessDoctypeMap(Base):
    """Maps a Paperless document type onto a material kind."""

    __tablename__ = "paperless_doctype_map"

    id = Column(Integer, primary_key=True, index=True)
    paperless_doctype_id = Column(Integer, unique=True, nullable=False)
    paperless_doctype_name = Column(String(200), nullable=False)
    # Stored as a plain string (MaterialKind.value) like other runtime-flexible
    # keys; see app.enums.MaterialKind for the valid set.
    material_kind = Column(String(20), default=MaterialKind.OTHER.value, nullable=False)


class PaperlessDocument(Base):
    """Cached metadata for one Paperless document.

    Rows are never hard-deleted by sync — a document missing from Paperless
    is flagged ``present=False`` so lesson/template links can't be
    cascade-orphaned by a flaky sync. ``external_id`` doubles as the
    unguessable capability URL for the thumbnail endpoint (same pattern as
    ``ShopImage``).
    """

    __tablename__ = "paperless_documents"

    # The pg_trgm GIN indexes backing ILIKE search over title/keywords live
    # only in the migration (they need CREATE EXTENSION, which the ORM-driven
    # test schema can't assume).
    __table_args__ = (
        Index("idx_paperless_documents_subject_id", "subject_id"),
        # Covers the list filters and both facet GROUP BYs, which all start
        # from present=True.
        Index(
            "idx_paperless_documents_present_facets",
            "subject_id",
            "material_kind",
            postgresql_where=text("present"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    paperless_id = Column(Integer, unique=True, nullable=False, index=True)

    asn = Column(String(32))  # Archive Serial Number (nullable across versions)
    title = Column(String(500), nullable=False)
    correspondent = Column(String(200))

    paperless_doctype_id = Column(Integer)
    # Denormalized at sync time from the doctype map / first mapped tag so
    # list queries never join the map tables.
    material_kind = Column(String(20), default=MaterialKind.OTHER.value, nullable=False)
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    tag_ids = Column(JSON, default=list, nullable=False)

    page_count = Column(Integer)
    paperless_created = Column(DateTime(timezone=True))
    paperless_added = Column(DateTime(timezone=True))
    # Server-side modification timestamp from the last sweep; sync refetches
    # OCR content only when this moves (or keywords were never fetched).
    paperless_modified = Column(DateTime(timezone=True))

    # Lowercased distinct words (len > 3, capped) extracted from OCR content
    # when index_ocr is on — the ranking signal. Full OCR text is never stored.
    keywords = Column(Text)

    present = Column(Boolean, default=True, nullable=False)
    synced_at = Column(DateTime(timezone=True), default=_utcnow)

    subject = relationship("Subject", lazy="selectin")
    thumbnail = relationship(
        "PaperlessThumbnail",
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )


class PaperlessThumbnail(Base):
    """Lazily cached thumbnail bytes for a document.

    A separate table (like ``shop_images``) so metadata queries never drag
    image bytes.
    """

    __tablename__ = "paperless_thumbnails"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("paperless_documents.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    data = Column(LargeBinary, nullable=False)
    mime_type = Column(String(50), nullable=False)
    fetched_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    document = relationship("PaperlessDocument", back_populates="thumbnail")


def snapshot_fields(doc: "PaperlessDocument") -> dict:
    """Display fields copied onto attachment links at attach time.

    Shared by every attach path (lesson/template/assignment routers) so the
    snapshot shape stays identical across link tables.
    """
    return {
        "title": doc.title,
        "asn": doc.asn,
        "material_kind": doc.material_kind,
        "subject_id": doc.subject_id,
        "page_count": doc.page_count,
        "correspondent": doc.correspondent,
    }


class LessonPaperlessMaterial(Base):
    """A Paperless document attached to a lesson.

    Display fields are snapshotted at attach time so the planner renders
    without a live round-trip and attachments survive subject deletion or a
    Paperless disconnect.
    """

    __tablename__ = "lesson_paperless_materials"

    __table_args__ = (
        UniqueConstraint("lesson_id", "document_id", name="uq_lesson_paperless_doc"),
        Index("idx_lesson_paperless_materials_lesson_id", "lesson_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(
        Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    document_id = Column(
        Integer,
        ForeignKey("paperless_documents.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Snapshotted display fields (see class docstring).
    title = Column(String(500), nullable=False)
    asn = Column(String(32))
    material_kind = Column(String(20), default=MaterialKind.OTHER.value, nullable=False)
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    page_count = Column(Integer)
    correspondent = Column(String(200))

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    lesson = relationship("Lesson", back_populates="paperless_materials")
    document = relationship("PaperlessDocument", lazy="selectin")

    @property
    def external_id(self):
        """Thumbnail capability id of the linked document (schema field)."""
        return self.document.external_id if self.document else None


class TemplatePaperlessMaterial(Base):
    """A Paperless document attached to an assignment template.

    Students assigned work from the template can view/download the document
    via the authorized content proxy. Same snapshot rationale as
    :class:`LessonPaperlessMaterial`.
    """

    __tablename__ = "template_paperless_materials"

    __table_args__ = (
        UniqueConstraint(
            "template_id", "document_id", name="uq_template_paperless_doc"
        ),
        Index("idx_template_paperless_materials_template_id", "template_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(
        Integer,
        ForeignKey("assignment_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id = Column(
        Integer,
        ForeignKey("paperless_documents.id", ondelete="CASCADE"),
        nullable=False,
    )

    title = Column(String(500), nullable=False)
    asn = Column(String(32))
    material_kind = Column(String(20), default=MaterialKind.OTHER.value, nullable=False)
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    page_count = Column(Integer)
    correspondent = Column(String(200))

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    template = relationship("AssignmentTemplate", back_populates="paperless_materials")
    document = relationship("PaperlessDocument", lazy="selectin")

    @property
    def external_id(self):
        """Thumbnail capability id of the linked document (schema field)."""
        return self.document.external_id if self.document else None


class StudentAssignmentPaperlessMaterial(Base):
    """A Paperless document attached to one assignment instance.

    Templates carry permanent materials (:class:`TemplatePaperlessMaterial`);
    this table holds the one-off extras picked at assign time or added to an
    existing assignment. The student sees both sets merged and the content
    proxy authorizes either link. Same snapshot rationale as
    :class:`LessonPaperlessMaterial`.
    """

    __tablename__ = "student_assignment_paperless_materials"

    __table_args__ = (
        UniqueConstraint(
            "student_assignment_id",
            "document_id",
            name="uq_student_assignment_paperless_doc",
        ),
        # Named by hand: the conventional idx_<table>_<column> form would
        # exceed Postgres's 63-char identifier limit.
        Index(
            "idx_sa_paperless_materials_student_assignment_id",
            "student_assignment_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_assignment_id = Column(
        Integer,
        ForeignKey("student_assignments.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id = Column(
        Integer,
        ForeignKey("paperless_documents.id", ondelete="CASCADE"),
        nullable=False,
    )

    title = Column(String(500), nullable=False)
    asn = Column(String(32))
    material_kind = Column(String(20), default=MaterialKind.OTHER.value, nullable=False)
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    page_count = Column(Integer)
    correspondent = Column(String(200))

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    student_assignment = relationship(
        "StudentAssignment", back_populates="paperless_materials"
    )
    document = relationship("PaperlessDocument", lazy="selectin")

    @property
    def external_id(self):
        """Thumbnail capability id of the linked document (schema field)."""
        return self.document.external_id if self.document else None
