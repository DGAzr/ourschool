"""add lesson planning

Revision ID: 5d9b1a4b16a5
Revises: add_point_tx_actor_name
Create Date: 2026-07-07 19:13:41.621252

Creates the full lesson-planning schema in one shot: ``lessons`` (planned
instructional blocks), their ordered child lists ``lesson_materials`` /
``lesson_resources``, the ``lesson_students`` association, the
``lessons_templates`` junction (a lesson links many assignment templates, each
with per-link overrides), and a nullable ``lesson_id`` FK on
``student_assignments`` so lesson-created assignments can be reconciled.

This is a pre-release collapse of two earlier iterative migrations into a single
final-state migration — the schema never ships an interim ``lessons.template_id``
column. All FKs from lessons to subjects/templates/users are ``SET NULL`` so
deleting those parents (or the backup wipe-and-restore that drops
assignment_templates) leaves lessons intact but un-linked; the
``student_assignments.lesson_id`` FK is also ``SET NULL`` — that null is how the
sync service "orphans" graded work.

Note: autogenerate surfaced unrelated pre-existing drift on other tables
(assignment_types, journal, term-grade indexes, server defaults). That drift is
intentionally NOT included here — this revision only touches lesson planning.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5d9b1a4b16a5'
down_revision: Union[str, None] = 'add_point_tx_actor_name'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lessons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(length=36), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('objective', sa.Text(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column(
            'status',
            sa.Enum('planned', 'ready', 'taught', name='lessonstatus'),
            nullable=False,
        ),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('external_id'),
    )
    op.create_index('idx_lessons_date', 'lessons', ['date'], unique=False)
    op.create_index(op.f('ix_lessons_id'), 'lessons', ['id'], unique=False)

    op.create_table(
        'lesson_materials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('is_gathered', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_lesson_materials_lesson_id', 'lesson_materials', ['lesson_id'], unique=False
    )
    op.create_index(
        op.f('ix_lesson_materials_id'), 'lesson_materials', ['id'], unique=False
    )

    op.create_table(
        'lesson_resources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_lesson_resources_lesson_id', 'lesson_resources', ['lesson_id'], unique=False
    )
    op.create_index(
        op.f('ix_lesson_resources_id'), 'lesson_resources', ['id'], unique=False
    )

    op.create_table(
        'lesson_students',
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('lesson_id', 'student_id'),
    )

    op.create_table(
        'lessons_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('custom_due_date', sa.Date(), nullable=True),
        sa.Column('custom_max_points', sa.Integer(), nullable=True),
        sa.Column('custom_instructions', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(
            ['template_id'], ['assignment_templates.id'], ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_id', 'template_id', name='uq_lesson_template'),
    )
    op.create_index(
        'idx_lessons_templates_lesson_id', 'lessons_templates', ['lesson_id'], unique=False
    )
    op.create_index(
        op.f('ix_lessons_templates_id'), 'lessons_templates', ['id'], unique=False
    )

    op.add_column(
        'student_assignments', sa.Column('lesson_id', sa.Integer(), nullable=True)
    )
    op.create_index(
        'idx_student_assignments_lesson_id',
        'student_assignments',
        ['lesson_id'],
        unique=False,
    )
    op.create_foreign_key(
        'fk_student_assignments_lesson_id',
        'student_assignments',
        'lessons',
        ['lesson_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_student_assignments_lesson_id', 'student_assignments', type_='foreignkey'
    )
    op.drop_index(
        'idx_student_assignments_lesson_id', table_name='student_assignments'
    )
    op.drop_column('student_assignments', 'lesson_id')

    op.drop_index(op.f('ix_lessons_templates_id'), table_name='lessons_templates')
    op.drop_index(
        'idx_lessons_templates_lesson_id', table_name='lessons_templates'
    )
    op.drop_table('lessons_templates')

    op.drop_table('lesson_students')

    op.drop_index(op.f('ix_lesson_resources_id'), table_name='lesson_resources')
    op.drop_index('idx_lesson_resources_lesson_id', table_name='lesson_resources')
    op.drop_table('lesson_resources')

    op.drop_index(op.f('ix_lesson_materials_id'), table_name='lesson_materials')
    op.drop_index('idx_lesson_materials_lesson_id', table_name='lesson_materials')
    op.drop_table('lesson_materials')

    op.drop_index(op.f('ix_lessons_id'), table_name='lessons')
    op.drop_index('idx_lessons_date', table_name='lessons')
    op.drop_table('lessons')

    # The lessonstatus enum type is created implicitly by the lessons table on
    # some backends but must be dropped explicitly on PostgreSQL.
    sa.Enum(name='lessonstatus').drop(op.get_bind(), checkfirst=True)
