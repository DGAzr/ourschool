"""Add default system settings for attendance

Revision ID: 66e6e8b92c62
Revises: a6249b8ffa4b
Create Date: 2025-08-16 18:28:25.481465

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '66e6e8b92c62'
down_revision: Union[str, None] = 'a6249b8ffa4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert default system settings
    op.execute("""
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_active) 
        VALUES ('attendance.required_days_of_instruction', '180', 'integer', 
                'Required number of instructional days per academic year for attendance calculations', true)
        ON CONFLICT (setting_key) DO NOTHING;
    """)


def downgrade() -> None:
    # Remove the setting
    op.execute("""
        DELETE FROM system_settings 
        WHERE setting_key = 'attendance.required_days_of_instruction';
    """)
