"""add lesson position

Revision ID: a1b2c3d4e5f6
Revises: 5d9b1a4b16a5
Create Date: 2026-07-07 20:00:00.000000

Adds ``lessons.position`` — a 0-based rank of each lesson within its ``date`` —
so the week planner can drag-and-drop reorder lessons within a day (and across
days). Existing lessons are backfilled per-day by ``id`` order so their current
visible order is preserved. The column is added with a server default of 0 to
satisfy the NOT NULL on existing rows, then the default is dropped to match the
model (which declares no server default).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5d9b1a4b16a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'lessons',
        sa.Column(
            'position', sa.Integer(), nullable=False, server_default='0'
        ),
    )
    # Backfill: each day's lessons get 0..N-1 by id order (preserves the
    # pre-existing creation-order display).
    op.execute(
        """
        UPDATE lessons SET position = sub.rn - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY date ORDER BY id) AS rn
            FROM lessons
        ) sub
        WHERE lessons.id = sub.id
        """
    )
    # Drop the server default so the schema matches the model.
    op.alter_column('lessons', 'position', server_default=None)


def downgrade() -> None:
    op.drop_column('lessons', 'position')
