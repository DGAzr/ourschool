"""Give canonical work and audit records stable backup identities.

Revision ID: c7d8e9f0a1b2
Revises: b6f7a8c9d0e1
"""

from alembic import op
import sqlalchemy as sa

revision = "c7d8e9f0a1b2"
down_revision = "b6f7a8c9d0e1"
branch_labels = None
depends_on = None

_TABLES = (
    "student_assignments",
    "assignment_time_entries",
    "point_transactions",
    "journal_entries",
    "journal_replies",
    "grade_history",
)


def upgrade():
    for table in _TABLES:
        op.add_column(table, sa.Column("external_id", sa.String(36), nullable=True))
        op.execute(sa.text(f"UPDATE {table} SET external_id = gen_random_uuid()::text"))
        op.alter_column(table, "external_id", nullable=False)
        op.create_unique_constraint(f"uq_{table}_external_id", table, ["external_id"])


def downgrade():
    for table in reversed(_TABLES):
        op.drop_constraint(f"uq_{table}_external_id", table, type_="unique")
        op.drop_column(table, "external_id")
