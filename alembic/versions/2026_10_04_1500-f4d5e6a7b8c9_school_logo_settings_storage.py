"""Allow normalized school logos in shared settings.

Revision ID: f4d5e6a7b8c9
Revises: f3c4d5e6a7b8
"""

from alembic import op
import sqlalchemy as sa

revision = "f4d5e6a7b8c9"
down_revision = "f3c4d5e6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "system_settings",
        "setting_value",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade():
    # Refuse to truncate retained school identity or other program records.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM system_settings WHERE length(setting_value) > 500) THEN
                RAISE EXCEPTION 'Cannot downgrade while settings exceed 500 characters; export and shorten them first';
            END IF;
        END $$
    """)
    op.alter_column(
        "system_settings",
        "setting_value",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=False,
    )
