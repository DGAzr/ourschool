# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.


"""CRUD operations for reports.

This package re-exports the full public API of the former single-module
``app.crud.reports`` so existing imports keep working unchanged.
"""

from datetime import date, timedelta  # noqa: F401
from typing import Dict, List, Optional  # noqa: F401

from app.models.assignment import (  # noqa: F401
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.attendance import AttendanceRecord  # noqa: F401
from app.models.journal import JournalEntry  # noqa: F401
from app.models.subject import Subject  # noqa: F401
from app.models.term import Term  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
from sqlalchemy import func  # noqa: F401
from sqlalchemy.orm import Session, joinedload  # noqa: F401
from app.crud import settings as crud_settings  # noqa: F401
from app.schemas import reports as schemas  # noqa: F401
from app.utils.attendance import (  # noqa: F401
    calculate_school_days,
    resolve_date_range_from_academic_year,
    calculate_attendance_rate,
    get_attendance_statistics,
    find_first_absence_date,
    generate_recent_activity_summary,
    get_required_days_of_instruction,
    get_attendance_settings,
)
from app.utils.performance import track_query_performance  # noqa: F401

from app.utils.grading import (  # noqa: F401 — calculate_letter_grade re-exported for backward compatibility
    calculate_letter_grade,
    compute_weighted_grade,
    effective_due_date,
    term_membership_filter,
)

from app.crud.reports.assignments import get_assignment_report  # noqa: F401
from app.crud.reports.attendance import (  # noqa: F401
    get_bulk_attendance_report,
    get_student_attendance_report,
)
from app.crud.reports.grades import (  # noqa: F401
    get_report_card,
    get_student_subject_performance,
    get_student_term_grades,
)
from app.crud.reports.overview import (  # noqa: F401
    get_academic_years,
    get_admin_report,
    get_all_students_progress,
    get_student_report,
)
from app.crud.reports.shared import (  # noqa: F401
    _build_weekly_series,
    _compute_trend_int,
    _glance_status,
    _grade_item,
    _is_graded,
    _journal_summary,
    _letter_grade,
)
