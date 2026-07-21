"""add template is_library

Revision ID: 5f72cfe3bdc1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-14 22:54:03.666715

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f72cfe3bdc1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assignment_templates",
        sa.Column(
            "is_library", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )


def downgrade() -> None:
    op.drop_column("assignment_templates", "is_library")
