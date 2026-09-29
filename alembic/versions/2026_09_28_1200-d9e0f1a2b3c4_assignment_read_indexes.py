"""Indexes for paged assignment and template reads.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
"""
from alembic import op

revision = 'd9e0f1a2b3c4'
down_revision = 'c8d9e0f1a2b3'
branch_labels = None
depends_on = None

INDEXES = {
    'idx_sa_due_id': 'student_assignments (due_date, id)',
    'idx_sa_status_due_id': 'student_assignments (status, due_date, id)',
    'idx_sa_assigned_id': 'student_assignments (assigned_date, id)',
    'idx_sa_student_effective_due_id': 'student_assignments (student_id, (coalesce(extended_due_date, due_date)), id)',
    'idx_sa_student_term_date': 'student_assignments (student_id, (coalesce(extended_due_date, due_date, assigned_date)))',
    'idx_at_library_name_id': 'assignment_templates (is_archived, is_library, (lower(name)), id)',
    'idx_at_name_trgm': 'assignment_templates USING gin (name gin_trgm_ops)',
    'idx_at_description_trgm': 'assignment_templates USING gin (description gin_trgm_ops)',
}


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    # These are new indexes on potentially populated beta installations. Build
    # concurrently rather than blocking assignment writes during deployment.
    with op.get_context().autocommit_block():
        for name, definition in INDEXES.items():
            # Retry-safe even after an interrupted concurrent index build leaves
            # an INVALID index. These names belong exclusively to this revision.
            op.execute(f'DROP INDEX CONCURRENTLY IF EXISTS {name}')
            op.execute(f'CREATE INDEX CONCURRENTLY {name} ON {definition}')


def downgrade():
    with op.get_context().autocommit_block():
        for name in reversed(INDEXES):
            op.execute(f'DROP INDEX CONCURRENTLY IF EXISTS {name}')
