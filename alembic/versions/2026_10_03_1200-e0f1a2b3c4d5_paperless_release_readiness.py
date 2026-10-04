"""Namespace Paperless libraries and add durable sync jobs.

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
"""

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR

revision = "e0f1a2b3c4d5"
down_revision = "d9e0f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    legacy_id = str(uuid.uuid4())
    if bind.execute(sa.text("SELECT count(*) FROM paperless_connection")).scalar() > 1:
        raise RuntimeError(
            "Multiple Paperless connections need reconciliation before migration"
        )
    op.create_table(
        "paperless_libraries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("url", sa.String(500)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_paperless_libraries_url", "paperless_libraries", ["url"])
    bind.execute(
        sa.text(
            "INSERT INTO paperless_libraries(id,url) VALUES (:id,(SELECT url FROM paperless_connection LIMIT 1))"
        ),
        {"id": legacy_id},
    )
    for table, column, unique_name in (
        ("paperless_documents", "paperless_id", "uq_paperless_library_document"),
        ("paperless_tag_subject_map", "paperless_tag_id", "uq_paperless_library_tag"),
        (
            "paperless_doctype_map",
            "paperless_doctype_id",
            "uq_paperless_library_doctype",
        ),
    ):
        op.add_column(
            table,
            sa.Column(
                "library_id", sa.String(36), nullable=False, server_default=legacy_id
            ),
        )
        op.create_foreign_key(
            f"fk_{table}_library", table, "paperless_libraries", ["library_id"], ["id"]
        )
        # The initial document migration creates a unique index rather than a constraint.
        inspector = sa.inspect(bind)
        for constraint in inspector.get_unique_constraints(table):
            if constraint["column_names"] == [column]:
                op.drop_constraint(constraint["name"], table, type_="unique")
        for index in sa.inspect(bind).get_indexes(table):
            if index.get("unique") and index["column_names"] == [column]:
                op.drop_index(index["name"], table_name=table)
                op.create_index(index["name"], table, [column])
        op.create_unique_constraint(unique_name, table, ["library_id", column])
        op.alter_column(table, "library_id", server_default=None)
    op.add_column(
        "paperless_connection",
        sa.Column(
            "library_id", sa.String(36), nullable=False, server_default=legacy_id
        ),
    )
    op.create_foreign_key(
        "fk_paperless_connection_library",
        "paperless_connection",
        "paperless_libraries",
        ["library_id"],
        ["id"],
    )
    op.alter_column("paperless_connection", "library_id", server_default=None)
    bind.execute(sa.text("UPDATE paperless_connection SET id = 1"))
    op.create_check_constraint(
        "ck_paperless_single_connection", "paperless_connection", "id = 1"
    )
    for column in (
        sa.Column("revision", sa.Integer, nullable=False, server_default="1"),
        sa.Column("api_version", sa.Integer, nullable=False, server_default="10"),
        sa.Column(
            "sync_interval_minutes", sa.Integer, nullable=False, server_default="15"
        ),
        sa.Column(
            "needs_reconnect", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column("next_sync_at", sa.DateTime(timezone=True)),
        sa.Column("last_success_at", sa.DateTime(timezone=True)),
    ):
        op.add_column("paperless_connection", column)
    bind.execute(
        sa.text(
            "UPDATE paperless_connection SET last_success_at = last_sync_at WHERE last_sync_status = 'ok'"
        )
    )
    op.add_column(
        "paperless_documents", sa.Column("ocr_indexed_at", sa.DateTime(timezone=True))
    )
    bind.execute(
        sa.text(
            "UPDATE paperless_documents SET ocr_indexed_at = synced_at WHERE keywords IS NOT NULL"
        )
    )
    op.create_index(
        "idx_paperless_library_order",
        "paperless_documents",
        [
            "library_id",
            "present",
            sa.text("paperless_added DESC NULLS LAST"),
            sa.text("id DESC"),
        ],
    )
    op.add_column(
        "paperless_documents",
        sa.Column(
            "search_vector",
            TSVECTOR,
            sa.Computed(
                "to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(keywords,''))",
                persisted=True,
            ),
        ),
    )
    op.create_index(
        "idx_paperless_search_terms",
        "paperless_documents",
        ["search_vector"],
        postgresql_using="gin",
    )
    op.execute(
        "CREATE INDEX idx_paperless_correspondent_trgm ON paperless_documents USING gin (correspondent gin_trgm_ops)"
    )
    op.create_table(
        "paperless_sync_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "library_id",
            sa.String(36),
            sa.ForeignKey("paperless_libraries.id"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer, nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("phase", sa.String(30), nullable=False),
        sa.Column("processed", sa.Integer, nullable=False),
        sa.Column("counts", sa.JSON, nullable=False),
        sa.Column("attempt", sa.Integer, nullable=False),
        sa.Column("owner", sa.String(36)),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.Text),
    )
    op.create_index(
        "uq_paperless_active_job",
        "paperless_sync_jobs",
        ["library_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('queued','running')"),
    )
    op.create_table(
        "paperless_sync_stage",
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("paperless_sync_jobs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("kind", sa.String(20), primary_key=True),
        sa.Column("upstream_id", sa.Integer, primary_key=True),
        sa.Column("payload", sa.JSON, nullable=False),
    )


def downgrade():
    # Restoring global uniqueness would otherwise silently destroy library identity.
    bind = op.get_bind()
    if (
        bind.execute(
            sa.text("SELECT count(DISTINCT library_id) FROM paperless_documents")
        ).scalar()
        > 1
    ):
        raise RuntimeError(
            "Cannot downgrade multiple populated Paperless libraries; restore a pre-upgrade backup"
        )
    for table in ("paperless_tag_subject_map", "paperless_doctype_map"):
        if (
            bind.execute(
                sa.text(f"SELECT count(DISTINCT library_id) FROM {table}")
            ).scalar()
            > 1
        ):
            raise RuntimeError("Cannot downgrade multiple Paperless mapping namespaces")
    op.drop_table("paperless_sync_stage")
    op.drop_table("paperless_sync_jobs")
    for name in (
        "idx_paperless_search_terms",
        "idx_paperless_correspondent_trgm",
        "idx_paperless_library_order",
    ):
        op.drop_index(name, table_name="paperless_documents")
    op.drop_column("paperless_documents", "search_vector")
    op.drop_column("paperless_documents", "ocr_indexed_at")
    op.drop_constraint(
        "ck_paperless_single_connection", "paperless_connection", type_="check"
    )
    for column in (
        "revision",
        "api_version",
        "sync_interval_minutes",
        "needs_reconnect",
        "next_sync_at",
        "last_success_at",
    ):
        op.drop_column("paperless_connection", column)
    for table, column, unique_name in (
        ("paperless_documents", "paperless_id", "uq_paperless_library_document"),
        ("paperless_tag_subject_map", "paperless_tag_id", "uq_paperless_library_tag"),
        (
            "paperless_doctype_map",
            "paperless_doctype_id",
            "uq_paperless_library_doctype",
        ),
    ):
        op.drop_constraint(unique_name, table, type_="unique")
        op.create_unique_constraint(f"{table}_{column}_key", table, [column])
    for table in (
        "paperless_connection",
        "paperless_documents",
        "paperless_tag_subject_map",
        "paperless_doctype_map",
    ):
        op.drop_constraint(f"fk_{table}_library", table, type_="foreignkey")
        op.drop_column(table, "library_id")
    op.drop_table("paperless_libraries")
