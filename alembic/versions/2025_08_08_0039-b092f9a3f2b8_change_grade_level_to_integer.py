"""change_grade_level_to_integer

Revision ID: b092f9a3f2b8
Revises: 74e3c52e185b
Create Date: 2025-08-08 00:39:23.130271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b092f9a3f2b8'
down_revision: Union[str, None] = '74e3c52e185b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # First, add a temporary column for the new integer values
    op.add_column('users', sa.Column('grade_level_temp', sa.Integer, nullable=True))
    
    # Get connection to execute raw SQL for data conversion
    connection = op.get_bind()
    
    # Convert existing string grade levels to integers
    # Extract numeric values from strings like "5th Grade", "3rd Grade", etc.
    connection.execute(sa.text("""
        UPDATE users 
        SET grade_level_temp = CASE 
            WHEN grade_level IS NULL THEN NULL
            WHEN grade_level ~ '^[0-9]+' THEN CAST(REGEXP_REPLACE(grade_level, '[^0-9].*', '') AS INTEGER)
            ELSE NULL
        END
    """))
    
    # Drop the old column
    op.drop_column('users', 'grade_level')
    
    # Rename the temporary column to the original name
    op.alter_column('users', 'grade_level_temp', new_column_name='grade_level')


def downgrade() -> None:
    # Add a temporary string column
    op.add_column('users', sa.Column('grade_level_temp', sa.String, nullable=True))
    
    # Get connection to execute raw SQL for data conversion
    connection = op.get_bind()
    
    # Convert integers back to grade level strings
    connection.execute(sa.text("""
        UPDATE users 
        SET grade_level_temp = CASE 
            WHEN grade_level IS NULL THEN NULL
            WHEN grade_level = 1 THEN '1st Grade'
            WHEN grade_level = 2 THEN '2nd Grade' 
            WHEN grade_level = 3 THEN '3rd Grade'
            WHEN grade_level BETWEEN 4 AND 12 THEN CAST(grade_level AS TEXT) || 'th Grade'
            ELSE CAST(grade_level AS TEXT) || 'th Grade'
        END
    """))
    
    # Drop the integer column
    op.drop_column('users', 'grade_level')
    
    # Rename the temporary column back
    op.alter_column('users', 'grade_level_temp', new_column_name='grade_level')
