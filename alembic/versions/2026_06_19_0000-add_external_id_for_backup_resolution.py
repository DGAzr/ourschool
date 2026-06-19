"""Add external_id UUID to users, subjects, terms, assignment_templates for stable backup resolution

Revision ID: add_external_id_backup
Revises: remove_lessons_feature
Create Date: 2026-06-19

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_external_id_backup'
down_revision = 'remove_lessons_feature'
branch_labels = None
depends_on = None


def upgrade():
    # Enable pgcrypto for gen_random_uuid() — idempotent
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    for table in ('users', 'subjects', 'terms', 'assignment_templates'):
        op.add_column(table, sa.Column(
            'external_id',
            sa.String(36),
            nullable=True,
        ))
        # Backfill existing rows
        op.execute(f"UPDATE {table} SET external_id = gen_random_uuid()::text WHERE external_id IS NULL")
        # Now enforce NOT NULL and uniqueness
        op.alter_column(table, 'external_id', nullable=False)
        op.create_unique_constraint(f'uq_{table}_external_id', table, ['external_id'])


def downgrade():
    for table in ('users', 'subjects', 'terms', 'assignment_templates'):
        op.drop_constraint(f'uq_{table}_external_id', table, type_='unique')
        op.drop_column(table, 'external_id')
