"""Add configurable icon field to subjects, assignment types, templates, and journal entries.

Icons are stored as lucide icon name strings (e.g. 'book-open'). The field is
nullable on all tables so existing rows are unaffected until the user picks an
icon in the admin UI. Default assignment types are backfilled with appropriate
lucide icon names that mirror the previous hard-coded emoji map.

Revision ID: add_icon_to_entities
Revises: assignment_types_dynamic
Create Date: 2026-06-20 03:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_icon_to_entities"
down_revision: Union[str, None] = "assignment_types_dynamic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default icon names for the built-in assignment types (key -> lucide name).
_TYPE_ICONS = {
    "homework": "pencil-line",
    "project": "hammer",
    "test": "bar-chart-3",
    "quiz": "help-circle",
    "essay": "pen-tool",
    "presentation": "presentation",
    "worksheet": "file-text",
    "reading": "book-open",
    "practice": "target",
}


def upgrade() -> None:
    # --- subjects ---
    op.add_column("subjects", sa.Column("icon", sa.String(), nullable=True))

    # --- assignment_types ---
    op.add_column("assignment_types", sa.Column("icon", sa.String(length=50), nullable=True))

    # Backfill the built-in assignment types with their default icons.
    conn = op.get_bind()
    for key, icon in _TYPE_ICONS.items():
        conn.execute(
            sa.text(
                "UPDATE assignment_types SET icon = :icon WHERE key = :key AND icon IS NULL"
            ),
            {"icon": icon, "key": key},
        )

    # --- assignment_templates ---
    op.add_column("assignment_templates", sa.Column("icon", sa.String(length=50), nullable=True))

    # --- journal_entries ---
    op.add_column("journal_entries", sa.Column("icon", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("journal_entries", "icon")
    op.drop_column("assignment_templates", "icon")
    op.drop_column("assignment_types", "icon")
    op.drop_column("subjects", "icon")
