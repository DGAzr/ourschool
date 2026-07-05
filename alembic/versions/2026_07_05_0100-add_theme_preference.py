"""Add users.theme_preference for server-side theme persistence.

Stores the user's UI theme choice ("light" | "dark" | "system"). NULL means
no stored preference; the client falls back to localStorage, then "system".

Revision ID: add_theme_preference
Revises: add_must_change_password
Create Date: 2026-07-05 01:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_theme_preference"
down_revision: Union[str, None] = "add_must_change_password"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("theme_preference", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "theme_preference")
