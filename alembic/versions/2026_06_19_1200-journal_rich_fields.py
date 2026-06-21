"""Add rich fields to journal_entries and journal_replies table

Revision ID: journal_rich_fields
Revises: add_external_id_backup
Create Date: 2026-06-19

"""
from alembic import op
import sqlalchemy as sa

revision = 'journal_rich_fields'
down_revision = 'add_external_id_backup'
branch_labels = None
depends_on = None


def upgrade():
    # Add rich fields to journal_entries
    op.add_column('journal_entries', sa.Column('mood', sa.String(20), nullable=True))
    op.add_column('journal_entries', sa.Column('tags', sa.JSON, nullable=True))
    op.add_column('journal_entries', sa.Column('win', sa.Text, nullable=True))
    op.add_column('journal_entries', sa.Column('goals', sa.JSON, nullable=True))
    op.add_column('journal_entries', sa.Column('reactions', sa.JSON, nullable=True))
    op.add_column('journal_entries', sa.Column('needs_response', sa.Boolean, nullable=False, server_default='true'))
    op.add_column('journal_entries', sa.Column('points_awarded', sa.Integer, nullable=True))

    # Create journal_replies table
    op.create_table(
        'journal_replies',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('entry_id', sa.Integer(), sa.ForeignKey('journal_entries.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Insert default journal_points_per_entry setting if not exists
    op.execute("""
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_active, created_at, updated_at)
        VALUES ('journal_points_per_entry', '5', 'string', 'Points awarded per journal entry (first entry per day)', true, now(), now())
        ON CONFLICT (setting_key) DO NOTHING
    """)


def downgrade():
    op.drop_table('journal_replies')
    op.drop_column('journal_entries', 'points_awarded')
    op.drop_column('journal_entries', 'needs_response')
    op.drop_column('journal_entries', 'reactions')
    op.drop_column('journal_entries', 'goals')
    op.drop_column('journal_entries', 'win')
    op.drop_column('journal_entries', 'tags')
    op.drop_column('journal_entries', 'mood')
    op.execute("DELETE FROM system_settings WHERE setting_key = 'journal_points_per_entry'")
