"""add student-created work, time logs, and journal edit metadata

Revision ID: b7c8d9e0f1a2
Revises: 6a83c91d2ef4
Create Date: 2026-08-23 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "6a83c91d2ef4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "student_assignments",
        sa.Column(
            "is_student_created",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.execute(
        "UPDATE student_assignments SET time_spent_minutes = 0 WHERE time_spent_minutes IS NULL"
    )
    op.alter_column(
        "student_assignments",
        "time_spent_minutes",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="0",
    )

    op.create_table(
        "assignment_time_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("logged_by", sa.Integer(), nullable=True),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "minutes > 0 AND minutes <= 1440", name="ck_time_entry_minutes"
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id"], ["student_assignments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["logged_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_assignment_time_entries_assignment_id",
        "assignment_time_entries",
        ["assignment_id"],
    )
    op.create_index(
        "idx_assignment_time_entries_logged_by",
        "assignment_time_entries",
        ["logged_by"],
    )
    op.create_index(
        op.f("ix_assignment_time_entries_id"),
        "assignment_time_entries",
        ["id"],
    )

    # Preserve pre-feature totals as a single auditable legacy entry. The
    # original assigned_by actor is used when still present.
    op.execute("""
        INSERT INTO assignment_time_entries
            (assignment_id, logged_by, work_date, minutes, note, created_at, updated_at)
        SELECT id,
               assigned_by,
               COALESCE(updated_at::date, assigned_date),
               time_spent_minutes,
               'Imported legacy total',
               COALESCE(updated_at, created_at),
               COALESCE(updated_at, created_at)
        FROM student_assignments
        WHERE time_spent_minutes > 0
        """)

    op.add_column(
        "journal_entries",
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "journal_entries", sa.Column("edited_by", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_journal_entries_edited_by_users",
        "journal_entries",
        "users",
        ["edited_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_journal_entries_edited_by_users", "journal_entries", type_="foreignkey"
    )
    op.drop_column("journal_entries", "edited_by")
    op.drop_column("journal_entries", "edited_at")
    op.drop_index(
        op.f("ix_assignment_time_entries_id"),
        table_name="assignment_time_entries",
    )
    op.drop_index(
        "idx_assignment_time_entries_logged_by",
        table_name="assignment_time_entries",
    )
    op.drop_index(
        "idx_assignment_time_entries_assignment_id",
        table_name="assignment_time_entries",
    )
    op.drop_table("assignment_time_entries")
    op.alter_column(
        "student_assignments",
        "time_spent_minutes",
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None,
    )
    op.drop_column("student_assignments", "is_student_created")
