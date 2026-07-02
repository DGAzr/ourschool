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


"""CRUD operations for attendance reports."""

from datetime import date
from typing import Optional

from app.models.attendance import AttendanceRecord
from app.models.user import User, UserRole
from sqlalchemy.orm import Session
from app.schemas import reports as schemas
from app.utils.attendance import (
    calculate_school_days,
    resolve_date_range_from_academic_year,
    calculate_attendance_rate,
    get_attendance_statistics,
    find_first_absence_date,
    generate_recent_activity_summary,
    get_required_days_of_instruction,
    get_attendance_settings,
)
from app.utils.performance import track_query_performance

# Note: calculate_school_days function moved to app.utils.attendance


@track_query_performance("get_student_attendance_report")
def get_student_attendance_report(
    db: Session,
    student_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    academic_year: Optional[str] = None,
) -> schemas.StudentAttendanceReport:
    """Get detailed attendance report for a specific student."""

    # Resolve date range using utility function
    start_date, end_date = resolve_date_range_from_academic_year(
        db, academic_year, start_date, end_date
    )
    # Get student info
    student = (
        db.query(User)
        .filter(User.id == student_id, User.role == UserRole.STUDENT)
        .first()
    )

    if not student:
        raise ValueError("Student not found")

    # Get attendance records
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date,
        )
        .order_by(AttendanceRecord.date)
        .all()
    )

    # Calculate totals using utility functions
    att_settings = get_attendance_settings(db)
    total_school_days = calculate_school_days(
        start_date, end_date, skip_weekends=att_settings["skip_weekends"]
    )
    required_days_of_instruction = get_required_days_of_instruction(db)

    # Get attendance statistics
    attendance_stats = get_attendance_statistics(attendance_records)
    # Use school-days denominator so unrecorded days accurately lower the rate.
    attendance_rate = (
        calculate_attendance_rate(
            attendance_records,
            total_school_days=total_school_days,
            count_excused=att_settings["count_excused"],
        )
        or 0.0
    )
    first_absence_date = find_first_absence_date(attendance_records)
    recent_activity_summary = generate_recent_activity_summary(attendance_records)

    # Create summary
    summary = schemas.AttendanceReportSummary(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        student_first_name=student.first_name,
        student_last_name=student.last_name,
        grade_level=student.grade_level,
        total_school_days=total_school_days,
        total_possible_days=total_school_days,  # Alias for frontend
        required_days_of_instruction=required_days_of_instruction,
        present_days=attendance_stats["present_days"],
        absent_days=attendance_stats["absent_days"],
        late_days=attendance_stats["late_days"],
        excused_days=attendance_stats["excused_days"],
        attendance_rate=round(attendance_rate, 2),
        attendance_percentage=round(attendance_rate, 2),  # Alias for frontend
        start_date=start_date,
        end_date=end_date,
        first_absence_date=first_absence_date,
        recent_activity_summary=recent_activity_summary,
    )

    # Create daily records
    daily_records = [
        schemas.AttendanceReportDetail(
            date=record.date, status=record.status.value, notes=record.notes
        )
        for record in attendance_records
    ]

    return schemas.StudentAttendanceReport(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        grade_level=student.grade_level,
        academic_year=academic_year,
        summary=summary,
        daily_records=daily_records,
        daily_attendance=daily_records,  # Alias for frontend
    )


@track_query_performance("get_bulk_attendance_report")
def get_bulk_attendance_report(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    academic_year: Optional[str] = None,
) -> schemas.BulkAttendanceReport:
    """Get attendance report for all students (admin view)."""

    # Resolve date range using utility function
    start_date, end_date = resolve_date_range_from_academic_year(
        db, academic_year, start_date, end_date
    )
    # Get all students - no admin filtering in homeschool context
    students_query = db.query(User).filter(User.role == UserRole.STUDENT)
    students = students_query.all()

    # Calculate total school days and get required instruction days
    att_settings = get_attendance_settings(db)
    total_school_days = calculate_school_days(
        start_date, end_date, skip_weekends=att_settings["skip_weekends"]
    )
    required_days_of_instruction = get_required_days_of_instruction(db)

    student_summaries = []

    for student in students:
        # Get attendance records for this student
        attendance_records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.date >= start_date,
                AttendanceRecord.date <= end_date,
            )
            .all()
        )

        # Calculate totals using utility functions
        attendance_stats = get_attendance_statistics(attendance_records)
        # Use school-days denominator so unrecorded days accurately lower the rate.
        attendance_rate = (
            calculate_attendance_rate(
                attendance_records,
                total_school_days=total_school_days,
                count_excused=att_settings["count_excused"],
            )
            or 0.0
        )
        first_absence_date = find_first_absence_date(attendance_records)
        recent_activity_summary = generate_recent_activity_summary(attendance_records)

        student_summaries.append(
            schemas.AttendanceReportSummary(
                student_id=student.id,
                student_name=f"{student.first_name} {student.last_name}",
                student_first_name=student.first_name,
                student_last_name=student.last_name,
                grade_level=student.grade_level,
                total_school_days=total_school_days,
                total_possible_days=total_school_days,  # Alias for frontend
                required_days_of_instruction=required_days_of_instruction,
                present_days=attendance_stats["present_days"],
                absent_days=attendance_stats["absent_days"],
                late_days=attendance_stats["late_days"],
                excused_days=attendance_stats["excused_days"],
                attendance_rate=round(attendance_rate, 2),
                attendance_percentage=round(attendance_rate, 2),  # Alias for frontend
                start_date=start_date,
                end_date=end_date,
                first_absence_date=first_absence_date,
                recent_activity_summary=recent_activity_summary,
            )
        )

    # Calculate overall statistics
    total_students = len(student_summaries)
    total_present = sum(s.present_days for s in student_summaries)
    total_absent = sum(s.absent_days for s in student_summaries)
    total_late = sum(s.late_days for s in student_summaries)
    total_excused = sum(s.excused_days for s in student_summaries)
    average_attendance_rate = (
        sum(s.attendance_rate for s in student_summaries) / total_students
        if total_students > 0
        else 0.0
    )

    overall_stats = schemas.BulkAttendanceReportOverallStats(
        total_students=total_students,
        average_attendance_rate=round(average_attendance_rate, 2),
        total_present=total_present,
        total_absent=total_absent,
        total_late=total_late,
        total_excused=total_excused,
    )

    return schemas.BulkAttendanceReport(
        academic_year=academic_year,
        start_date=start_date,
        end_date=end_date,
        total_school_days=total_school_days,
        students=student_summaries,
        student_attendance=student_summaries,  # Alias for frontend
        overall_stats=overall_stats,
    )
