"""add lesson drawer placement

Revision ID: 6a83c91d2ef4
Revises: 5f72cfe3bdc1
Create Date: 2026-08-15 12:00:00.000000

Allows lessons to be unscheduled (``date IS NULL``) and records the most
recent scheduled date for context when a lesson is parked in the drawer.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "6a83c91d2ef4"
down_revision: Union[str, None] = "5f72cfe3bdc1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("last_scheduled_date", sa.Date(), nullable=True))
    op.alter_column("lessons", "date", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    op.execute(
        "UPDATE lessons "
        "SET date = COALESCE(last_scheduled_date, DATE '2026-08-15') "
        "WHERE date IS NULL"
    )
    op.alter_column("lessons", "date", existing_type=sa.Date(), nullable=False)
    op.drop_column("lessons", "last_scheduled_date")
