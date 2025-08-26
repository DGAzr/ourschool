"""Remove completed status and migrate to submitted

Revision ID: a6249b8ffa4b
Revises: 9a9b19785108
Create Date: 2025-08-16 16:47:34.360496

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6249b8ffa4b'
down_revision: Union[str, None] = '9a9b19785108'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update all assignments with 'completed' status to 'submitted'
    connection = op.get_bind()
    
    # Update student assignments with completed status to submitted
    connection.execute(
        sa.text("""
            UPDATE student_assignments 
            SET status = 'submitted'
            WHERE status = 'completed'
        """)
    )
    
    print(f"Migration: Updated assignments with 'completed' status to 'submitted'")


def downgrade() -> None:
    # Note: This downgrade is imperfect because we can't distinguish
    # between originally 'submitted' assignments and migrated 'completed' ones
    # We'll leave all as 'submitted' for data safety
    print("Warning: Downgrade cannot perfectly restore 'completed' status. All assignments remain 'submitted'.")
