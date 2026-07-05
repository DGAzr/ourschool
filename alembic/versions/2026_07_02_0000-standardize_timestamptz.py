"""Standardize all datetime columns on TIMESTAMP WITH TIME ZONE.

The app has always written UTC values (datetime.now(timezone.utc)), but most
tables declared plain TIMESTAMP, so the values were stored naive. This
converts every remaining naive datetime column to timestamptz, interpreting
existing values as UTC — the same conversion already applied to api_keys in
restore_indexes_tz. points/system_settings tables were created timezone-aware
and are not touched.

Revision ID: standardize_timestamptz
Revises: add_icon_to_entities
Create Date: 2026-07-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "standardize_timestamptz"
down_revision: Union[str, None] = "add_icon_to_entities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column) pairs still stored as TIMESTAMP WITHOUT TIME ZONE.
TZ_COLUMNS = [
    ("users", "created_at"),
    ("users", "updated_at"),
    ("subjects", "created_at"),
    ("terms", "created_at"),
    ("terms", "updated_at"),
    ("term_subjects", "created_at"),
    ("student_term_grades", "created_at"),
    ("student_term_grades", "updated_at"),
    ("student_term_grades", "last_calculated"),
    ("grade_history", "changed_at"),
    ("assignment_templates", "created_at"),
    ("assignment_templates", "updated_at"),
    ("student_assignments", "created_at"),
    ("student_assignments", "updated_at"),
    ("assignment_types", "created_at"),
    ("assignment_types", "updated_at"),
    ("attendance_records", "created_at"),
    ("attendance_records", "updated_at"),
    ("journal_entries", "entry_date"),
    ("journal_entries", "created_at"),
    ("journal_entries", "updated_at"),
    ("journal_replies", "created_at"),
]


def upgrade() -> None:
    for table, col in TZ_COLUMNS:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {col} "
            f"TYPE TIMESTAMP WITH TIME ZONE USING {col} AT TIME ZONE 'UTC'"
        )


def downgrade() -> None:
    for table, col in TZ_COLUMNS:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {col} "
            f"TYPE TIMESTAMP WITHOUT TIME ZONE USING {col} AT TIME ZONE 'UTC'"
        )
