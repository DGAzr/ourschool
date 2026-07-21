"""paperless integration

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-11 12:00:00.000000

Adds the Paperless-NGX integration: a local metadata cache of a self-hosted
Paperless document server plus attachment links to lessons and assignment
templates.

Eight tables, created in FK order:
- ``paperless_connection`` — single-row server config (Fernet-encrypted token,
  sync toggles, sync scope, last-sync bookkeeping).
- ``paperless_tag_subject_map`` — Paperless tag → OurSchool subject.
- ``paperless_doctype_map`` — Paperless document type → material kind.
- ``paperless_documents`` — cached document metadata (soft-deleted via
  ``present`` flag, never hard-deleted by sync).
- ``paperless_thumbnails`` — lazily cached thumbnail bytea (separate table so
  metadata queries never drag bytes).
- ``lesson_paperless_materials`` — document attached to a lesson, with
  snapshotted display fields.
- ``template_paperless_materials`` — document attached to an assignment
  template (student-visible), same snapshot shape.
- ``student_assignment_paperless_materials`` — one-off document attached to a
  single assignment instance, same snapshot shape.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "paperless_connection",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("token_encrypted", sa.Text(), nullable=False),
        sa.Column("auto_import", sa.Boolean(), nullable=False),
        sa.Column("index_ocr", sa.Boolean(), nullable=False),
        sa.Column("mapped_only", sa.Boolean(), nullable=False),
        sa.Column("scope_tag_ids", sa.JSON(), nullable=True),
        sa.Column("scope_doctype_ids", sa.JSON(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(length=20), nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.Column("document_count", sa.Integer(), nullable=False),
        sa.Column("tag_count", sa.Integer(), nullable=False),
        sa.Column("doctype_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_paperless_connection_id"), "paperless_connection", ["id"], unique=False
    )

    op.create_table(
        "paperless_tag_subject_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("paperless_tag_id", sa.Integer(), nullable=False),
        sa.Column("paperless_tag_name", sa.String(length=200), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("auto_matched", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("paperless_tag_id"),
    )
    op.create_index(
        op.f("ix_paperless_tag_subject_map_id"),
        "paperless_tag_subject_map",
        ["id"],
        unique=False,
    )

    op.create_table(
        "paperless_doctype_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("paperless_doctype_id", sa.Integer(), nullable=False),
        sa.Column("paperless_doctype_name", sa.String(length=200), nullable=False),
        sa.Column("material_kind", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("paperless_doctype_id"),
    )
    op.create_index(
        op.f("ix_paperless_doctype_map_id"),
        "paperless_doctype_map",
        ["id"],
        unique=False,
    )

    op.create_table(
        "paperless_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=36), nullable=False),
        sa.Column("paperless_id", sa.Integer(), nullable=False),
        sa.Column("asn", sa.String(length=32), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("correspondent", sa.String(length=200), nullable=True),
        sa.Column("paperless_doctype_id", sa.Integer(), nullable=True),
        sa.Column("material_kind", sa.String(length=20), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("tag_ids", sa.JSON(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("paperless_created", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paperless_added", sa.DateTime(timezone=True), nullable=True),
        sa.Column("keywords", sa.Text(), nullable=True),
        sa.Column("present", sa.Boolean(), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index(
        op.f("ix_paperless_documents_id"), "paperless_documents", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_paperless_documents_paperless_id"),
        "paperless_documents",
        ["paperless_id"],
        unique=True,
    )
    op.create_index(
        "idx_paperless_documents_subject_id",
        "paperless_documents",
        ["subject_id"],
        unique=False,
    )

    op.create_table(
        "paperless_thumbnails",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("mime_type", sa.String(length=50), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id"], ["paperless_documents.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id"),
    )
    op.create_index(
        op.f("ix_paperless_thumbnails_id"), "paperless_thumbnails", ["id"], unique=False
    )

    op.create_table(
        "lesson_paperless_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("asn", sa.String(length=32), nullable=True),
        sa.Column("material_kind", sa.String(length=20), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("correspondent", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["document_id"], ["paperless_documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", "document_id", name="uq_lesson_paperless_doc"),
    )
    op.create_index(
        op.f("ix_lesson_paperless_materials_id"),
        "lesson_paperless_materials",
        ["id"],
        unique=False,
    )
    op.create_index(
        "idx_lesson_paperless_materials_lesson_id",
        "lesson_paperless_materials",
        ["lesson_id"],
        unique=False,
    )

    op.create_table(
        "template_paperless_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("asn", sa.String(length=32), nullable=True),
        sa.Column("material_kind", sa.String(length=20), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("correspondent", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["template_id"], ["assignment_templates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["paperless_documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "template_id", "document_id", name="uq_template_paperless_doc"
        ),
    )
    op.create_index(
        op.f("ix_template_paperless_materials_id"),
        "template_paperless_materials",
        ["id"],
        unique=False,
    )
    op.create_index(
        "idx_template_paperless_materials_template_id",
        "template_paperless_materials",
        ["template_id"],
        unique=False,
    )

    op.create_table(
        "student_assignment_paperless_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_assignment_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("asn", sa.String(length=32), nullable=True),
        sa.Column("material_kind", sa.String(length=20), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("correspondent", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["student_assignment_id"], ["student_assignments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["paperless_documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_assignment_id",
            "document_id",
            name="uq_student_assignment_paperless_doc",
        ),
    )
    op.create_index(
        op.f("ix_student_assignment_paperless_materials_id"),
        "student_assignment_paperless_materials",
        ["id"],
        unique=False,
    )
    # Named by hand: idx_<table>_<column> would exceed Postgres's 63-char limit.
    op.create_index(
        "idx_sa_paperless_materials_student_assignment_id",
        "student_assignment_paperless_materials",
        ["student_assignment_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_sa_paperless_materials_student_assignment_id",
        table_name="student_assignment_paperless_materials",
    )
    op.drop_index(
        op.f("ix_student_assignment_paperless_materials_id"),
        table_name="student_assignment_paperless_materials",
    )
    op.drop_table("student_assignment_paperless_materials")

    op.drop_index(
        "idx_template_paperless_materials_template_id",
        table_name="template_paperless_materials",
    )
    op.drop_index(
        op.f("ix_template_paperless_materials_id"),
        table_name="template_paperless_materials",
    )
    op.drop_table("template_paperless_materials")

    op.drop_index(
        "idx_lesson_paperless_materials_lesson_id",
        table_name="lesson_paperless_materials",
    )
    op.drop_index(
        op.f("ix_lesson_paperless_materials_id"),
        table_name="lesson_paperless_materials",
    )
    op.drop_table("lesson_paperless_materials")

    op.drop_index(op.f("ix_paperless_thumbnails_id"), table_name="paperless_thumbnails")
    op.drop_table("paperless_thumbnails")

    op.drop_index(
        "idx_paperless_documents_subject_id", table_name="paperless_documents"
    )
    op.drop_index(
        op.f("ix_paperless_documents_paperless_id"), table_name="paperless_documents"
    )
    op.drop_index(op.f("ix_paperless_documents_id"), table_name="paperless_documents")
    op.drop_table("paperless_documents")

    op.drop_index(
        op.f("ix_paperless_doctype_map_id"), table_name="paperless_doctype_map"
    )
    op.drop_table("paperless_doctype_map")

    op.drop_index(
        op.f("ix_paperless_tag_subject_map_id"), table_name="paperless_tag_subject_map"
    )
    op.drop_table("paperless_tag_subject_map")

    op.drop_index(op.f("ix_paperless_connection_id"), table_name="paperless_connection")
    op.drop_table("paperless_connection")
