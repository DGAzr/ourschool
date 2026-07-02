"""Add users.must_change_password for forced password rotation.

Set for the seeded default admin and for admin-issued temporary passwords;
enforced at the auth layer until the user picks a new password.

Revision ID: add_must_change_password
Revises: standardize_timestamptz
Create Date: 2026-07-02 01:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_must_change_password"
down_revision: Union[str, None] = "standardize_timestamptz"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
