"""Explicit lesson activity publication and relative deadlines.

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
"""

from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e6"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "lessons_templates",
        sa.Column(
            "assignment_timing",
            sa.String(20),
            nullable=False,
            server_default="on_schedule",
        ),
    )
    op.add_column(
        "lessons_templates",
        sa.Column("due_offset_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_lesson_assignment_timing",
        "lessons_templates",
        "assignment_timing IN ('draft', 'on_schedule', 'now')",
    )
    op.create_check_constraint(
        "ck_lesson_due_offset", "lessons_templates", "due_offset_days BETWEEN 0 AND 365"
    )


def downgrade():
    op.drop_constraint("ck_lesson_due_offset", "lessons_templates", type_="check")
    op.drop_constraint(
        "ck_lesson_assignment_timing", "lessons_templates", type_="check"
    )
    op.drop_column("lessons_templates", "due_offset_days")
    op.drop_column("lessons_templates", "assignment_timing")
