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

"""Utility functions for attendance calculations and operations."""

from datetime import date, timedelta
from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceStatus
from app.models.term import Term
from app.crud import settings as crud_settings


def calculate_school_days(
    start_date: date, end_date: date, skip_weekends: bool = True
) -> int:
    """Calculate number of school days between two dates."""
    current_date = start_date
    school_days = 0

    while current_date <= end_date:
        if skip_weekends:
            if current_date.weekday() < 5:  # Monday–Friday only
                school_days += 1
        else:
            school_days += 1
        current_date += timedelta(days=1)

    return school_days


def resolve_date_range_from_academic_year(
    db: Session,
    academic_year: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Tuple[date, date]:
    """
    Resolve date range from academic year or explicit dates.

    Args:
        db: Database session
        academic_year: Academic year string (e.g., "2024-2025")
        start_date: Explicit start date
        end_date: Explicit end date

    Returns:
        Tuple of (start_date, end_date)

    Raises:
        ValueError: If neither academic_year nor both dates are provided, or if academic year not found
    """
    # If academic_year is provided but dates are not, derive dates from terms
    if academic_year and (not start_date or not end_date):
        academic_year_data = (
            db.query(
                func.min(Term.start_date).label("start_date"),
                func.max(Term.end_date).label("end_date"),
            )
            .filter(Term.academic_year == academic_year)
            .first()
        )

        if (
            academic_year_data
            and academic_year_data.start_date
            and academic_year_data.end_date
        ):
            return academic_year_data.start_date, academic_year_data.end_date
        else:
            raise ValueError(f"No terms found for academic year {academic_year}")

    if not start_date or not end_date:
        raise ValueError(
            "start_date and end_date are required when academic_year is not provided"
        )

    return start_date, end_date


def calculate_attendance_rate(
    attendance_records: list,
    total_school_days: Optional[int] = None,
    count_excused: bool = True,
) -> Optional[float]:
    """
    Calculate attendance rate from recorded attendance days.

    When ``total_school_days`` is omitted (the default, used by every report:
    admin overview, student progress, report card, and attendance reports) the
    denominator is the number of *recorded* days — unrecorded days are days
    school wasn't held, not misses. Compliance toward required instructional
    days is tracked separately via present-day counts against
    ``required_days_of_instruction``.

    When ``total_school_days`` is provided, that figure is used as the
    denominator instead, so unrecorded days lower the rate.  Returns ``None``
    when the denominator is zero.

    Args:
        attendance_records: List of AttendanceRecord objects
        total_school_days: Optional calendar school-day count for the reporting
            period; when provided this is used as the denominator.
        count_excused: When True (default), excused absences count as
            acceptable attendance. When False, they do not.

    Returns:
        Attendance rate as a percentage (0-100), or None if denominator is zero.
    """
    present_days = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.PRESENT
    )
    late_days = sum(1 for r in attendance_records if r.status == AttendanceStatus.LATE)
    excused_days = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.EXCUSED
    )

    acceptable_days = present_days + late_days + (excused_days if count_excused else 0)

    if total_school_days is not None:
        # Accurate rate: unrecorded school days count against the student
        if total_school_days == 0:
            return None
        return acceptable_days / total_school_days * 100
    else:
        # Legacy rate: only considers days that were explicitly recorded
        total_recorded = len(attendance_records)
        if total_recorded == 0:
            return None
        return acceptable_days / total_recorded * 100


def get_attendance_statistics(attendance_records: list) -> dict:
    """
    Get attendance statistics from a list of attendance records.

    Args:
        attendance_records: List of AttendanceRecord objects

    Returns:
        Dictionary with attendance statistics
    """
    present_days = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.PRESENT
    )
    absent_days = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.ABSENT
    )
    late_days = sum(1 for r in attendance_records if r.status == AttendanceStatus.LATE)
    excused_days = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.EXCUSED
    )

    return {
        "present_days": present_days,
        "absent_days": absent_days,
        "late_days": late_days,
        "excused_days": excused_days,
    }


def find_first_absence_date(attendance_records: list) -> Optional[str]:
    """
    Find the first absence date from attendance records.

    Args:
        attendance_records: List of AttendanceRecord objects

    Returns:
        ISO date string of first absence, or None if no absences
    """
    for record in sorted(attendance_records, key=lambda x: x.date):
        if record.status == AttendanceStatus.ABSENT:
            return record.date.isoformat()
    return None


def generate_recent_activity_summary(
    attendance_records: list, limit: int = 3
) -> Optional[str]:
    """
    Generate a summary of recent attendance activity.

    Args:
        attendance_records: List of AttendanceRecord objects
        limit: Number of recent records to include

    Returns:
        Summary string or None if no records
    """
    if not attendance_records:
        return None

    recent_records = sorted(attendance_records, key=lambda x: x.date, reverse=True)[
        :limit
    ]
    activities = []
    for record in recent_records:
        activities.append(f"{record.date.strftime('%m/%d')}: {record.status.value}")
    return ", ".join(activities)


def get_required_days_of_instruction(db: Session) -> int:
    """
    Get the required days of instruction from system settings.

    Args:
        db: Database session

    Returns:
        Required days of instruction (default: 180)
    """
    return crud_settings.get_setting_value(
        db, "attendance.required_days_of_instruction", default_value=180, value_type=int
    )


def get_attendance_settings(db: Session) -> dict:
    """Return skip_weekends and count_excused booleans from system settings."""
    return {
        "skip_weekends": crud_settings.get_setting_value(
            db, "attendance.skip_weekends", default_value=True, value_type=bool
        ),
        "count_excused": crud_settings.get_setting_value(
            db, "attendance.count_excused", default_value=True, value_type=bool
        ),
    }
