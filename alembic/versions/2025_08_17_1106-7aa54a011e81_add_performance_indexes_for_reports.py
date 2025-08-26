"""Add performance indexes for reports

Revision ID: 7aa54a011e81
Revises: 66e6e8b92c62
Create Date: 2025-08-17 11:06:50.742641

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7aa54a011e81'
down_revision: Union[str, None] = '66e6e8b92c62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add composite index for attendance records (student_id, date) for efficient date range queries
    op.create_index(
        'idx_attendance_records_student_date',
        'attendance_records',
        ['student_id', 'date']
    )
    
    # Add composite index for student assignments (student_id, assigned_date) for report queries
    op.create_index(
        'idx_student_assignments_student_assigned_date',
        'student_assignments',
        ['student_id', 'assigned_date']
    )
    
    # Add composite index for student assignments (student_id, graded_date) for performance tracking
    op.create_index(
        'idx_student_assignments_student_graded_date',
        'student_assignments',
        ['student_id', 'graded_date']
    )
    
    # Add index on assignment_templates.subject_id for joins in reports
    op.create_index(
        'idx_assignment_templates_subject_id',
        'assignment_templates',
        ['subject_id']
    )
    
    # Add index on terms (academic_year, start_date) for academic year queries
    op.create_index(
        'idx_terms_academic_year_start_date',
        'terms',
        ['academic_year', 'start_date']
    )


def downgrade() -> None:
    # Remove indexes in reverse order
    op.drop_index('idx_terms_academic_year_start_date', 'terms')
    op.drop_index('idx_assignment_templates_subject_id', 'assignment_templates')
    op.drop_index('idx_student_assignments_student_graded_date', 'student_assignments')
    op.drop_index('idx_student_assignments_student_assigned_date', 'student_assignments')
    op.drop_index('idx_attendance_records_student_date', 'attendance_records')
