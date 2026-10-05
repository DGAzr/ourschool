"""Paper completion, task help and learner preferences.
Revision ID: f2b3c4d5e6a7
Revises: f1a2b3c4d5e6
"""

from alembic import op
import sqlalchemy as sa

revision = "f2b3c4d5e6a7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "student_ui_mode", sa.String(10), nullable=False, server_default="regular"
        ),
    )
    for name in ("show_points", "show_effort_signals", "celebrate_completion"):
        op.add_column(
            "users",
            sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    op.create_check_constraint(
        "ck_student_ui_mode", "users", "student_ui_mode IN ('regular', 'simple')"
    )
    op.add_column(
        "student_assignments",
        sa.Column(
            "submission_method", sa.String(10), nullable=False, server_default="online"
        ),
    )
    op.create_check_constraint(
        "ck_submission_method",
        "student_assignments",
        "submission_method IN ('online', 'paper')",
    )
    op.create_table(
        "assignment_help_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "assignment_id",
            sa.Integer(),
            sa.ForeignKey("student_assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("response", sa.Text()),
    )
    op.create_index(
        "ix_assignment_help_requests_assignment_id",
        "assignment_help_requests",
        ["assignment_id"],
    )


def downgrade():
    op.drop_table("assignment_help_requests")
    op.drop_constraint("ck_submission_method", "student_assignments", type_="check")
    op.drop_column("student_assignments", "submission_method")
    op.drop_constraint("ck_student_ui_mode", "users", type_="check")
    for name in (
        "student_ui_mode",
        "show_points",
        "show_effort_signals",
        "celebrate_completion",
    ):
        op.drop_column("users", name)
