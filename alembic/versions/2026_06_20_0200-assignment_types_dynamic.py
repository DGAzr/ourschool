"""Dynamic admin-managed assignment types with grade-book weights

Creates the ``assignment_types`` table, seeds it from the previously hard-coded
``AssignmentType`` enum, and converts
``assignment_templates.assignment_type`` from a native enum column to a plain
string that references ``assignment_types.key``.

Revision ID: assignment_types_dynamic
Revises: fk_ondelete_policy
Create Date: 2026-06-20 02:00:00.000000

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "assignment_types_dynamic"
down_revision: Union[str, None] = "fk_ondelete_policy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (key, display name, color) seeded from the legacy AssignmentType enum so
# existing templates keep resolving and grades are unchanged (weights start at
# 0 -> neutral points-weighting).
_SEED_TYPES = [
    ("homework", "Homework", "#3B82F6"),
    ("project", "Project", "#8B5CF6"),
    ("test", "Test", "#EF4444"),
    ("quiz", "Quiz", "#F59E0B"),
    ("essay", "Essay", "#10B981"),
    ("presentation", "Presentation", "#EC4899"),
    ("worksheet", "Worksheet", "#6366F1"),
    ("reading", "Reading", "#14B8A6"),
    ("practice", "Practice", "#84CC16"),
]


def upgrade() -> None:
    assignment_types = op.create_table(
        "assignment_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.String(length=36), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False, server_default="#3B82F6"),
        sa.Column("weight", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("external_id", name="uq_assignment_types_external_id"),
        sa.UniqueConstraint("key", name="uq_assignment_types_key"),
    )
    op.create_index(
        "ix_assignment_types_key", "assignment_types", ["key"], unique=False
    )

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        assignment_types,
        [
            {
                "external_id": str(uuid.uuid4()),
                "key": key,
                "name": name,
                "color": color,
                "weight": 0.0,
                "is_active": True,
                "display_order": idx,
                "created_at": now,
                "updated_at": now,
            }
            for idx, (key, name, color) in enumerate(_SEED_TYPES)
        ],
    )

    # Convert the enum column to a plain string referencing assignment_types.key.
    op.execute(
        "ALTER TABLE assignment_templates "
        "ALTER COLUMN assignment_type DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE assignment_templates "
        "ALTER COLUMN assignment_type TYPE VARCHAR(50) "
        "USING assignment_type::text"
    )
    op.execute(
        "ALTER TABLE assignment_templates "
        "ALTER COLUMN assignment_type SET DEFAULT 'homework'"
    )

    # The legacy multiplier-based weights setting is superseded by per-type
    # weights on the new table.
    op.execute(
        "DELETE FROM system_settings WHERE setting_key = 'grades.type_weights'"
    )

    # Drop the now-unused native enum type if it exists (Postgres only).
    op.execute("DROP TYPE IF EXISTS assignmenttype")


def downgrade() -> None:
    # Recreate the native enum type and convert the column back.
    op.execute(
        "CREATE TYPE assignmenttype AS ENUM ("
        "'homework','project','test','quiz','essay',"
        "'presentation','worksheet','reading','practice')"
    )
    op.execute(
        "ALTER TABLE assignment_templates "
        "ALTER COLUMN assignment_type DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE assignment_templates "
        "ALTER COLUMN assignment_type TYPE assignmenttype "
        "USING assignment_type::assignmenttype"
    )
    op.execute(
        "ALTER TABLE assignment_templates "
        "ALTER COLUMN assignment_type SET DEFAULT 'homework'"
    )

    op.drop_index("ix_assignment_types_key", table_name="assignment_types")
    op.drop_table("assignment_types")
