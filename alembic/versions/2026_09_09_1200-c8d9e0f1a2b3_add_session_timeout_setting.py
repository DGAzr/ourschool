"""add configurable session timeout setting

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-09-09 12:00:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO system_settings
            (setting_key, setting_value, setting_type, description, is_active)
        VALUES
            ('security.session_timeout_minutes', '30', 'integer',
             'Rolling session timeout in minutes; 0 disables expiration', true)
        ON CONFLICT (setting_key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM system_settings
        WHERE setting_key = 'security.session_timeout_minutes'
        """
    )
