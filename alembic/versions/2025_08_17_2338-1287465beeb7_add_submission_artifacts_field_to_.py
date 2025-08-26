"""add submission artifacts field to student assignments

Revision ID: 1287465beeb7
Revises: 83ea02f5b877
Create Date: 2025-08-17 23:38:53.290339

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1287465beeb7'
down_revision: Union[str, None] = '83ea02f5b877'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add submission_artifacts column to student_assignments table
    op.add_column('student_assignments', sa.Column('submission_artifacts', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove submission_artifacts column from student_assignments table
    op.drop_column('student_assignments', 'submission_artifacts')
