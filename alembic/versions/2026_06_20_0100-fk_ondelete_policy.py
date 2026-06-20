"""Set explicit ON DELETE policy on user FKs; unique attendance per day

Revision ID: fk_ondelete_policy
Revises: restore_indexes_tz
Create Date: 2026-06-20

Deleting a user previously raised ForeignKeyViolation (audit columns like
created_by/assigned_by are NOT NULL with no ON DELETE) or risked orphaning
rows on non-ORM deletes. This makes the policy explicit at the DB level:

  * Owned child data CASCADEs when the owning student is deleted.
  * Actor/audit references SET NULL when the acting user is deleted (and the
    columns are made nullable to allow it), preserving the historical record.

Also adds a unique constraint guaranteeing one attendance record per student
per day (verified no duplicates exist before adding).

All changes are transactional; a failure rolls back cleanly.
"""
from alembic import op


revision = "fk_ondelete_policy"
down_revision = "restore_indexes_tz"
branch_labels = None
depends_on = None


# (table, column, constraint_name, was_not_null)
SET_NULL_FKS = [
    ("assignment_templates", "created_by", "assignment_templates_created_by_fkey", True),
    ("terms", "created_by", "terms_created_by_fkey", True),
    ("student_assignments", "assigned_by", "student_assignments_assigned_by_fkey", True),
    ("student_assignments", "graded_by", "student_assignments_graded_by_fkey", False),
    ("student_term_grades", "finalized_by", "student_term_grades_finalized_by_fkey", False),
    ("grade_history", "changed_by", "grade_history_changed_by_fkey", True),
    ("point_transactions", "admin_id", "point_transactions_admin_id_fkey", False),
    ("api_keys", "created_by", "api_keys_created_by_fkey", True),
]

# (table, column, constraint_name)
CASCADE_FKS = [
    ("student_assignments", "student_id", "student_assignments_student_id_fkey"),
    ("student_points", "student_id", "student_points_student_id_fkey"),
    ("point_transactions", "student_id", "point_transactions_student_id_fkey"),
    ("student_term_grades", "student_id", "student_term_grades_student_id_fkey"),
    ("journal_entries", "student_id", "journal_entries_student_id_fkey"),
    ("journal_entries", "author_id", "journal_entries_author_id_fkey"),
    ("journal_replies", "author_id", "journal_replies_author_id_fkey"),
]


def upgrade():
    # Audit/actor columns -> SET NULL (make nullable first where required).
    for table, column, constraint, was_not_null in SET_NULL_FKS:
        if was_not_null:
            op.alter_column(table, column, nullable=True)
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint, table, "users", [column], ["id"], ondelete="SET NULL"
        )

    # Owned child data -> CASCADE.
    for table, column, constraint in CASCADE_FKS:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint, table, "users", [column], ["id"], ondelete="CASCADE"
        )

    # One attendance record per student per day.
    op.create_unique_constraint(
        "uq_attendance_student_date", "attendance_records", ["student_id", "date"]
    )


def downgrade():
    op.drop_constraint("uq_attendance_student_date", "attendance_records", type_="unique")

    for table, column, constraint in CASCADE_FKS:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(constraint, table, "users", [column], ["id"])

    for table, column, constraint, was_not_null in SET_NULL_FKS:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(constraint, table, "users", [column], ["id"])
        if was_not_null:
            # Reverts to NOT NULL; fails if any rows were nulled by a delete.
            op.alter_column(table, column, nullable=False)
