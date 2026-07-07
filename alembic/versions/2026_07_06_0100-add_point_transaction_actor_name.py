"""Add point_transactions.actor_name for durable attribution.

API-key writes have no admin user row (admin_id is NULL), so the ledger could
only show a generic "API Integration" while the adjust response showed the
key's name. Persisting the actor label at write time keeps the audit trail
consistent. NULL means legacy row / no explicit actor; display falls back to
the admin relationship, then "API Integration".

Revision ID: add_point_tx_actor_name
Revises: add_theme_preference
Create Date: 2026-07-06 01:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_point_tx_actor_name"
down_revision: Union[str, None] = "add_theme_preference"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "point_transactions",
        sa.Column("actor_name", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("point_transactions", "actor_name")
