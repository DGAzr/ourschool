"""Track explicitly configured mappings and scoped mapping availability.

Revision ID: a5e6f7b8c9d0
Revises: f4d5e6a7b8c9
"""

from alembic import op
import sqlalchemy as sa

revision = "a5e6f7b8c9d0"
down_revision = "f4d5e6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("paperless_tag_subject_map", "paperless_doctype_map"):
        for column in ("configured", "in_scope"):
            op.add_column(
                table,
                sa.Column(
                    column, sa.Boolean(), nullable=False, server_default=sa.false()
                ),
            )
    op.add_column(
        "paperless_connection",
        sa.Column("mapping_scope_tag_ids", sa.JSON(), nullable=True),
    )
    op.add_column(
        "paperless_connection",
        sa.Column("mapping_scope_doctype_ids", sa.JSON(), nullable=True),
    )
    op.execute("UPDATE paperless_tag_subject_map SET configured = NOT auto_matched")
    # Freeze the existing name-based defaults here; never import mutable app code.
    op.execute("""
        UPDATE paperless_doctype_map SET configured = material_kind <> CASE
          WHEN lower(paperless_doctype_name) LIKE '%worksheet%' THEN 'worksheet'
          WHEN lower(paperless_doctype_name) LIKE '%test%'
            OR lower(paperless_doctype_name) LIKE '%quiz%'
            OR lower(paperless_doctype_name) LIKE '%exam%' THEN 'test'
          WHEN lower(paperless_doctype_name) LIKE '%textbook%'
            OR lower(paperless_doctype_name) LIKE '%reading%'
            OR lower(paperless_doctype_name) LIKE '%book%' THEN 'reading'
          WHEN lower(paperless_doctype_name) LIKE '%reference%' THEN 'reference'
          WHEN lower(paperless_doctype_name) LIKE '%form%' THEN 'form'
          ELSE 'other' END
    """)


def downgrade():
    op.drop_column("paperless_connection", "mapping_scope_doctype_ids")
    op.drop_column("paperless_connection", "mapping_scope_tag_ids")
    for table in ("paperless_doctype_map", "paperless_tag_subject_map"):
        op.drop_column(table, "in_scope")
        op.drop_column(table, "configured")
