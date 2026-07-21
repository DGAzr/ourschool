"""paperless performance hardening

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-12 10:00:00.000000

Performance groundwork for the Paperless integration ahead of release:

- ``paperless_documents.paperless_modified`` — the server's modification
  timestamp from the last sweep; sync refetches OCR content only when it
  moves, making steady-state syncs O(changes) instead of O(library).
- A partial index covering the list filters and facet GROUP BYs (all queries
  start from ``present = true``).
- ``pg_trgm`` GIN indexes on ``title`` and ``keywords`` so the search's
  leading-wildcard ILIKE stops being a sequential scan as the library grows.
  These two live only here, not in the model: they need CREATE EXTENSION,
  which the ORM-driven test schema can't assume.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "paperless_documents",
        sa.Column("paperless_modified", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_paperless_documents_present_facets",
        "paperless_documents",
        ["subject_id", "material_kind"],
        postgresql_where=sa.text("present"),
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX idx_paperless_documents_title_trgm "
        "ON paperless_documents USING gin (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX idx_paperless_documents_keywords_trgm "
        "ON paperless_documents USING gin (keywords gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_paperless_documents_keywords_trgm")
    op.execute("DROP INDEX IF EXISTS idx_paperless_documents_title_trgm")
    op.drop_index(
        "idx_paperless_documents_present_facets", table_name="paperless_documents"
    )
    op.drop_column("paperless_documents", "paperless_modified")
