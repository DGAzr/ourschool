"""Remove lessons feature

Revision ID: remove_lessons_feature
Revises: 1287465beeb7
Create Date: 2026-06-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'remove_lessons_feature'
down_revision = '1287465beeb7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop FK constraint before dropping the column
    # Use IF EXISTS via raw SQL to handle databases where the constraint
    # may have a different name (explicitly named constraints)
    from sqlalchemy import text
    conn = op.get_bind()
    conn.execute(text(
        "ALTER TABLE assignment_templates DROP CONSTRAINT IF EXISTS assignment_templates_lesson_id_fkey"
    ))

    # Drop lesson-related columns from assignment_templates
    op.drop_column('assignment_templates', 'lesson_id')
    op.drop_column('assignment_templates', 'order_in_lesson')

    # Drop lesson_assignments junction table first (has FK to lessons)
    op.drop_index(op.f('ix_lesson_assignments_id'), table_name='lesson_assignments')
    op.drop_table('lesson_assignments')

    # Drop lessons table
    op.drop_index(op.f('ix_lessons_id'), table_name='lessons')
    op.drop_table('lessons')


def downgrade() -> None:
    # Recreate lessons table with original schema (including difficulty_level)
    op.create_table(
        'lessons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('difficulty_level', sa.Enum('beginner', 'intermediate', 'advanced', name='difficultylevel'), nullable=True),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('estimated_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('materials_needed', sa.Text(), nullable=True),
        sa.Column('objectives', sa.Text(), nullable=True),
        sa.Column('prerequisites', sa.Text(), nullable=True),
        sa.Column('resources', sa.Text(), nullable=True),
        sa.Column('lesson_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_lessons_id'), 'lessons', ['id'], unique=False)

    # Recreate lesson_assignments table
    op.create_table(
        'lesson_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('assignment_template_id', sa.Integer(), nullable=False),
        sa.Column('order_in_lesson', sa.Integer(), nullable=True),
        sa.Column('planned_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('custom_instructions', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.Column('custom_max_points', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['assignment_template_id'], ['assignment_templates.id'], ),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_lesson_assignments_id'), 'lesson_assignments', ['id'], unique=False)

    # Restore columns on assignment_templates
    op.add_column('assignment_templates', sa.Column('lesson_id', sa.Integer(), nullable=True))
    op.add_column('assignment_templates', sa.Column('order_in_lesson', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'assignment_templates_lesson_id_fkey',
        'assignment_templates', 'lessons',
        ['lesson_id'], ['id']
    )
