"""Restore reporting indexes, fix api_keys timezone columns, external_id defaults

Revision ID: restore_indexes_tz
Revises: journal_rich_fields
Create Date: 2026-06-20

Background:
  * Migration 7aa54a011e81 created five reporting indexes that the next
    migration (83ea02f5b877) inadvertently dropped, so after `upgrade head`
    none existed. This recreates them (idempotently) plus several missing
    foreign-key indexes, and the models now declare them so autogenerate
    stops churning.
  * api_keys datetime columns were TIMESTAMP WITHOUT TIME ZONE while the model
    compares them to timezone-aware datetimes, which raises at runtime once a
    key with an expiry is loaded. Converted to TIMESTAMPTZ.
  * external_id had only a Python-side default; add a DB server default so any
    insert path (raw SQL / bulk / backup import) always gets a value.

All operations are additive/idempotent and safe to run on existing data.
"""
from alembic import op


revision = 'restore_indexes_tz'
down_revision = 'journal_rich_fields'
branch_labels = None
depends_on = None


# (index_name, table, columns) — recreated reporting indexes + missing FK indexes
INDEXES = [
    # Reporting indexes dropped by 83ea02f5b877
    ("idx_attendance_records_student_date", "attendance_records", "student_id, date"),
    ("idx_student_assignments_student_assigned_date", "student_assignments", "student_id, assigned_date"),
    ("idx_student_assignments_student_graded_date", "student_assignments", "student_id, graded_date"),
    ("idx_assignment_templates_subject_id", "assignment_templates", "subject_id"),
    ("idx_terms_academic_year_start_date", "terms", "academic_year, start_date"),
    # Missing FK / lookup indexes (Medium finding)
    ("idx_term_subjects_subject_id", "term_subjects", "subject_id"),
    ("idx_student_term_grades_student_id", "student_term_grades", "student_id"),
    ("idx_student_term_grades_term_subject_id", "student_term_grades", "term_subject_id"),
    ("idx_student_assignments_template_id", "student_assignments", "template_id"),
    ("idx_student_assignments_student_id", "student_assignments", "student_id"),
    ("idx_journal_entries_author_id", "journal_entries", "author_id"),
]

EXTERNAL_ID_TABLES = ("users", "subjects", "terms", "assignment_templates")
API_KEY_TZ_COLUMNS = ("last_used_at", "expires_at", "created_at", "updated_at")


def upgrade():
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})")

    # Convert api_keys datetime columns to timestamptz, interpreting existing
    # naive values as UTC (which is how the app wrote them).
    for col in API_KEY_TZ_COLUMNS:
        op.execute(
            f"ALTER TABLE api_keys ALTER COLUMN {col} "
            f"TYPE TIMESTAMP WITH TIME ZONE USING {col} AT TIME ZONE 'UTC'"
        )

    # Give external_id a DB-level default so non-ORM inserts always populate it.
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    for table in EXTERNAL_ID_TABLES:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN external_id "
            f"SET DEFAULT gen_random_uuid()::text"
        )


def downgrade():
    for table in EXTERNAL_ID_TABLES:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN external_id DROP DEFAULT")

    for col in API_KEY_TZ_COLUMNS:
        op.execute(
            f"ALTER TABLE api_keys ALTER COLUMN {col} "
            f"TYPE TIMESTAMP WITHOUT TIME ZONE USING {col} AT TIME ZONE 'UTC'"
        )

    for name, _table, _cols in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
