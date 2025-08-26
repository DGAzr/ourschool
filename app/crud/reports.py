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

"""CRUD operations for reports."""
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.assignment import (
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.lesson import Subject
from app.models.term import Term
from app.models.user import User, UserRole
from app.crud import settings as crud_settings
from app.schemas import reports as schemas
from app.utils.attendance import (
    calculate_school_days,
    resolve_date_range_from_academic_year,
    calculate_attendance_rate,
    get_attendance_statistics,
    find_first_absence_date,
    generate_recent_activity_summary,
    get_required_days_of_instruction,
)
from app.utils.performance import track_query_performance


def get_student_report(db: Session, student_id: int):
    """Get a report for a single student."""
    assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.student_id == student_id)
        .all()
    )

    total_assignments = len(assignments)
    completed_assignments = sum(
        1 for a in assignments if a.status == AssignmentStatus.GRADED
    )
    in_progress_assignments = sum(
        1 for a in assignments if a.status == AssignmentStatus.IN_PROGRESS
    )
    pending_grades = sum(
        1 for a in assignments if a.status == AssignmentStatus.SUBMITTED
    )

    graded_assignments = [
        a for a in assignments if a.is_graded and a.percentage_grade is not None
    ]
    if graded_assignments:
        average_grade = sum(a.percentage_grade for a in graded_assignments) / len(
            graded_assignments
        )
    else:
        average_grade = 0.0

    # Current term grade
    active_term = db.query(Term).filter(Term.is_active).first()
    current_term_grade = 0.0
    if active_term:
        term_assignments = [
            a
            for a in graded_assignments
            if a.assigned_date >= active_term.start_date
            and a.assigned_date <= active_term.end_date
        ]
        if term_assignments:
            current_term_grade = sum(
                a.percentage_grade for a in term_assignments
            ) / len(term_assignments)

    return schemas.StudentReport(
        total_assignments=total_assignments,
        completed_assignments=completed_assignments,
        in_progress_assignments=in_progress_assignments,
        pending_grades=pending_grades,
        average_grade=round(average_grade, 2),
        current_term_grade=round(current_term_grade, 2),
    )


@track_query_performance("get_admin_report")
def get_admin_report(db: Session):
    """Get a report for an admin."""
    total_students = db.query(User).filter(User.role == UserRole.STUDENT).count()

    active_assignments = (
        db.query(StudentAssignment)
        .filter(
            StudentAssignment.status.in_(
                [AssignmentStatus.IN_PROGRESS, AssignmentStatus.SUBMITTED]
            )
        )
        .count()
    )

    pending_grades = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.status == AssignmentStatus.SUBMITTED)
        .count()
    )

    total_assignments = db.query(StudentAssignment).count()
    completed_assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.status == AssignmentStatus.GRADED)
        .count()
    )

    # Calculate overall average grade
    avg_grade_query = (
        db.query(func.avg(StudentAssignment.percentage_grade))
        .filter(
            StudentAssignment.is_graded,
            StudentAssignment.percentage_grade.isnot(None),
        )
        .scalar()
    )

    return schemas.AdminReport(
        total_students=total_students,
        active_assignments=active_assignments,
        pending_grades=pending_grades,
        average_grade=round(avg_grade_query, 2) if avg_grade_query else 0.0,
        total_assignments=total_assignments,
        completed_assignments=completed_assignments,
    )


def get_student_term_grades(db: Session, student_id: int, term_id: Optional[int] = None):
    """Calculate term grades for a student, grouped by subject, for the specified or active term."""
    if term_id:
        # Get the specified term
        active_term = db.query(Term).filter(Term.id == term_id).first()
        if not active_term:
            return []
    else:
        active_term = db.query(Term).filter(Term.is_active).first()
        if not active_term:
            return []

    assignments = (
        db.query(StudentAssignment)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .filter(
            StudentAssignment.student_id == student_id,
            StudentAssignment.assigned_date >= active_term.start_date,
            StudentAssignment.assigned_date <= active_term.end_date,
        )
        .options(
            joinedload(StudentAssignment.template).joinedload(
                AssignmentTemplate.subject
            )
        )
        .all()
    )

    subject_grades = {}
    for assign in assignments:
        if not (assign.template and assign.template.subject):
            continue

        subject = assign.template.subject
        if subject.id not in subject_grades:
            subject_grades[subject.id] = {
                "term_id": active_term.id,
                "term_name": active_term.name,
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_color": subject.color,
                "total_points": 0,
                "earned_points": 0,
                "assignments_count": 0,
                "completed_count": 0,
            }

        max_points = assign.custom_max_points or assign.template.max_points
        subject_grades[subject.id]["total_points"] += max_points
        subject_grades[subject.id]["earned_points"] += assign.points_earned or 0
        subject_grades[subject.id]["assignments_count"] += 1
        if assign.status == AssignmentStatus.GRADED:
            subject_grades[subject.id]["completed_count"] += 1

    result = []
    for _subject_id, data in subject_grades.items():
        percentage = (
            (data["earned_points"] / data["total_points"]) * 100
            if data["total_points"] > 0
            else 0
        )

        if percentage >= 90:
            letter_grade = "A"
        elif percentage >= 80:
            letter_grade = "B"
        elif percentage >= 70:
            letter_grade = "C"
        elif percentage >= 60:
            letter_grade = "D"
        else:
            letter_grade = "F"

        result.append(
            schemas.TermGrade(
                **data, percentage=round(percentage, 2), letter_grade=letter_grade
            )
        )

    return result


def _calculate_subject_trend_data(db: Session, student_id: int, subject_id: int, term_id: Optional[int] = None):
    """Calculate trend data for a specific subject."""
    from app.models.assignment import StudentAssignment, AssignmentTemplate
    
    # Build query for graded assignments in this subject
    query = db.query(StudentAssignment).join(AssignmentTemplate).filter(
        StudentAssignment.student_id == student_id,
        AssignmentTemplate.subject_id == subject_id,
        StudentAssignment.is_graded == True,
        StudentAssignment.percentage_grade.isnot(None),
        StudentAssignment.graded_date.isnot(None)
    )
    
    # Filter by term if specified
    if term_id:
        from app.models.term import Term
        term = db.query(Term).filter(Term.id == term_id).first()
        if term:
            query = query.filter(
                StudentAssignment.assigned_date >= term.start_date,
                StudentAssignment.assigned_date <= term.end_date
            )
    
    # Get assignments ordered by graded date
    assignments = query.order_by(StudentAssignment.graded_date).all()
    
    if len(assignments) < 2:
        # Not enough data for trend, return current grade if available
        if assignments:
            return [schemas.TrendDataPoint(
                date=assignments[0].graded_date.isoformat(),
                average_grade=assignments[0].percentage_grade,
                assignments_count=1
            )]
        return []
    
    # Create trend buckets - aim for 4-5 data points
    num_buckets = min(5, len(assignments))
    bucket_size = max(1, len(assignments) // num_buckets)
    
    trend_data = []
    for i in range(0, len(assignments), bucket_size):
        bucket_assignments = assignments[i:i + bucket_size]
        if bucket_assignments:
            avg_grade = sum(a.percentage_grade for a in bucket_assignments) / len(bucket_assignments)
            # Use the latest date in the bucket
            latest_date = max(a.graded_date for a in bucket_assignments)
            
            trend_data.append(schemas.TrendDataPoint(
                date=latest_date.isoformat(),
                average_grade=round(avg_grade, 2),
                assignments_count=len(bucket_assignments)
            ))
    
    # Ensure we don't have more than 5 data points
    if len(trend_data) > 5:
        # Take evenly distributed points
        indices = [int(i * (len(trend_data) - 1) / 4) for i in range(5)]
        trend_data = [trend_data[i] for i in indices]
    
    return trend_data


def get_student_subject_performance(db: Session, student_id: int, term_id: Optional[int] = None):
    """Get a student's performance by subject, optionally filtered by term."""
    term_grades_by_subject = {}

    term_grades = get_student_term_grades(db, student_id, term_id=term_id)

    for grade in term_grades:
        if grade.subject_id not in term_grades_by_subject:
            term_grades_by_subject[grade.subject_id] = {
                "subject_id": grade.subject_id,
                "subject_name": grade.subject_name,
                "total_assignments": 0,
                "completed_assignments": 0,
                "total_percentage": 0,
                "term_count": 0,
                "terms": [],
            }

        subj_data = term_grades_by_subject[grade.subject_id]
        subj_data["total_assignments"] += grade.assignments_count
        subj_data["completed_assignments"] += grade.completed_count
        subj_data["total_percentage"] += grade.percentage
        subj_data["term_count"] += 1
        subj_data["terms"].append(grade)

    result = []
    for _subject_id, data in term_grades_by_subject.items():
        avg_percentage = (
            data["total_percentage"] / data["term_count"]
            if data["term_count"] > 0
            else 0
        )

        # Calculate trend data for this subject
        trend_data = _calculate_subject_trend_data(db, student_id, data["subject_id"], term_id)
        
        # Calculate total points from terms
        points_earned = sum(term.earned_points for term in data["terms"])
        points_possible = sum(term.total_points for term in data["terms"])

        result.append(
            schemas.SubjectPerformance(
                subject_id=data["subject_id"],
                subject_name=data["subject_name"],
                average_percentage=round(avg_percentage, 2),
                total_assignments=data["total_assignments"],
                completed_assignments=data["completed_assignments"],
                points_earned=points_earned,
                points_possible=points_possible,
                terms=data["terms"],
                trend_data=trend_data,
            )
        )

    return result


@track_query_performance("get_all_students_progress")
def get_all_students_progress(db: Session, term_id: Optional[int] = None):
    """Get the progress of all students, optionally filtered by term."""
    # 1. Find the appropriate term based on term_id filter
    if term_id:
        # Find the specified term
        active_term = db.query(Term).filter(Term.id == term_id).first()
    else:
        # Use the currently active term
        active_term = db.query(Term).filter(Term.is_active).first()

    students = (
        db.query(User)
        .filter(User.role == UserRole.STUDENT)
        .options(joinedload(User.assigned_assignments))
        .all()
    )

    result = []
    for student in students:
        # Overall stats (all time)
        total_assignments = len(student.assigned_assignments)
        completed_assignments = sum(
            1
            for a in student.assigned_assignments
            if a.status == AssignmentStatus.GRADED
        )

        graded_assignments = [
            a
            for a in student.assigned_assignments
            if a.is_graded and a.percentage_grade is not None
        ]
        if graded_assignments:
            avg_grade = sum(a.percentage_grade for a in graded_assignments) / len(
                graded_assignments
            )
        else:
            avg_grade = 0.0

        # Current term grade
        current_term_grade = 0.0
        if active_term:
            term_assignments = [
                a
                for a in graded_assignments
                if a.assigned_date >= active_term.start_date
                and a.assigned_date <= active_term.end_date
            ]
            if term_assignments:
                current_term_grade = sum(
                    a.percentage_grade for a in term_assignments
                ) / len(term_assignments)

        # Get subject performance for the student (filtered by term if specified)
        # Note: This could be optimized by batching all students' subject performance queries
        student_subject_performance = get_student_subject_performance(db, student.id, term_id=term_id)

        # Calculate attendance rate for the student
        # Use current academic year or active term dates for attendance calculation
        if active_term:
            # Use the academic year from the active term to get full year attendance
            try:
                start_date, end_date = resolve_date_range_from_academic_year(
                    db, active_term.academic_year, None, None
                )
                attendance_records = (
                    db.query(AttendanceRecord)
                    .filter(
                        AttendanceRecord.student_id == student.id,
                        AttendanceRecord.date >= start_date,
                        AttendanceRecord.date <= end_date,
                    )
                    .all()
                )
                required_days_of_instruction = get_required_days_of_instruction(db)
                student_attendance_rate = calculate_attendance_rate(attendance_records, required_days_of_instruction)
            except (ValueError, AttributeError):
                # Fallback if academic year lookup fails
                student_attendance_rate = None
        else:
            student_attendance_rate = None

        # Calculate additional fields
        pending_assignments = total_assignments - completed_assignments
        overdue_assignments = sum(
            1 for a in student.assigned_assignments 
            if a.status in [AssignmentStatus.IN_PROGRESS, AssignmentStatus.NOT_STARTED] 
            and a.due_date and a.due_date < date.today()
        )
        completion_rate = (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0
        
        # Get current term letter grade
        if current_term_grade >= 90:
            current_term_letter_grade = "A"
        elif current_term_grade >= 80:
            current_term_letter_grade = "B"
        elif current_term_grade >= 70:
            current_term_letter_grade = "C"
        elif current_term_grade >= 60:
            current_term_letter_grade = "D"
        else:
            current_term_letter_grade = "F"

        # Get last activity date
        last_activity_date = None
        if student.assigned_assignments:
            latest_assignment = max(
                (a for a in student.assigned_assignments if a.updated_at),
                key=lambda a: a.updated_at,
                default=None
            )
            if latest_assignment:
                last_activity_date = latest_assignment.updated_at.isoformat()

        result.append(
            schemas.StudentProgress(
                student_id=student.id,
                student_name=f"{student.first_name} {student.last_name}",
                first_name=student.first_name or "",
                last_name=student.last_name or "",
                email=student.email or "",
                grade_level=student.grade_level,
                current_term_percentage=round(current_term_grade, 2),
                current_term_letter_grade=current_term_letter_grade,
                overall_grade=round(avg_grade, 2),
                total_assignments=total_assignments,
                completed_assignments=completed_assignments,
                pending_assignments=pending_assignments,
                overdue_assignments=overdue_assignments,
                average_grade=round(avg_grade, 2),
                completion_rate=round(completion_rate, 2),
                attendance_rate=round(student_attendance_rate, 2) if student_attendance_rate is not None else None,
                last_activity_date=last_activity_date,
                subjects=student_subject_performance,
                subject_grades=student_subject_performance,  # Provide both for compatibility
            )
        )

    return result


def get_academic_years(db: Session) -> List[schemas.AcademicYear]:
    """Get all academic years from terms."""
    academic_years = (
        db.query(
            Term.academic_year,
            func.min(Term.start_date).label("start_date"),
            func.max(Term.end_date).label("end_date"),
            func.count(Term.id).label("terms_count"),
        )
        .group_by(Term.academic_year)
        .order_by(Term.academic_year.desc())
        .all()
    )

    return [
        schemas.AcademicYear(
            academic_year=year.academic_year,
            start_date=year.start_date,
            end_date=year.end_date,
            terms_count=year.terms_count,
        )
        for year in academic_years
    ]


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
    total_school_days = calculate_school_days(start_date, end_date)
    required_days_of_instruction = get_required_days_of_instruction(db)
    
    # Get attendance statistics
    attendance_stats = get_attendance_statistics(attendance_records)
    attendance_rate = calculate_attendance_rate(attendance_records, required_days_of_instruction)
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
    total_school_days = calculate_school_days(start_date, end_date)
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
        attendance_rate = calculate_attendance_rate(attendance_records, required_days_of_instruction)
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
        if total_students > 0 else 0.0
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


@track_query_performance("get_assignment_report")
def get_assignment_report(
    db: Session,
    subject_id: Optional[int] = None,
    student_id: Optional[int] = None,
    term_id: Optional[int] = None,
    status: Optional[str] = None,
) -> schemas.AssignmentReport:
    """Get comprehensive assignment report with filtering options."""
    # Create aliases for User table to avoid conflicts
    student_alias = db.query(User).subquery().alias("student")
    assigned_by_user_alias = db.query(User).subquery().alias("assigned_by_user")

    # Base query for assignments with all related data
    query = (
        db.query(
            StudentAssignment.id.label("assignment_id"),
            StudentAssignment.template_id,
            AssignmentTemplate.name.label("assignment_name"),
            AssignmentTemplate.assignment_type,
            StudentAssignment.student_id,
            func.concat(
                student_alias.c.first_name, " ", student_alias.c.last_name
            ).label("student_name"),
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            Subject.color.label("subject_color"),
            StudentAssignment.assigned_date,
            StudentAssignment.due_date,
            StudentAssignment.status,
            StudentAssignment.points_earned,
            func.coalesce(
                StudentAssignment.custom_max_points, AssignmentTemplate.max_points
            ).label("max_points"),
            StudentAssignment.percentage_grade,
            StudentAssignment.letter_grade,
            StudentAssignment.is_graded,
            StudentAssignment.graded_date,
            StudentAssignment.teacher_feedback,
            StudentAssignment.time_spent_minutes,
            func.concat(
                assigned_by_user_alias.c.first_name,
                " ",
                assigned_by_user_alias.c.last_name,
            ).label("assigned_by_name"),
        )
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .join(student_alias, StudentAssignment.student_id == student_alias.c.id)
        .join(Subject, AssignmentTemplate.subject_id == Subject.id)
        .join(
            assigned_by_user_alias,
            StudentAssignment.assigned_by == assigned_by_user_alias.c.id,
        )
    )

    # Apply filters
    # Note: No admin filtering in homeschool context - all admins can see all students

    if subject_id:
        query = query.filter(Subject.id == subject_id)

    if student_id:
        query = query.filter(StudentAssignment.student_id == student_id)

    if term_id:
        term = db.query(Term).filter(Term.id == term_id).first()
        if term:
            query = query.filter(
                StudentAssignment.assigned_date >= term.start_date,
                StudentAssignment.assigned_date <= term.end_date,
            )

    if status:
        query = query.filter(StudentAssignment.status == status)

    # Execute query and get results
    assignment_data = query.order_by(StudentAssignment.assigned_date.desc()).all()

    # Pre-fetch all terms to avoid N+1 queries
    all_terms = db.query(Term).all()
    term_lookup = {}
    for term in all_terms:
        for single_date in (term.start_date + timedelta(days=x) for x in range((term.end_date - term.start_date).days + 1)):
            term_lookup[single_date] = (term.id, term.name)

    # Build assignment list
    assignments = []

    for data in assignment_data:
        # Determine term for this assignment using pre-built lookup
        term_id_for_assignment = None
        term_name_for_assignment = None

        if data.assigned_date and data.assigned_date in term_lookup:
            term_id_for_assignment, term_name_for_assignment = term_lookup[data.assigned_date]

        assignments.append(
            schemas.AssignmentReportItem(
                assignment_id=data.assignment_id,
                template_id=data.template_id,
                assignment_name=data.assignment_name,
                assignment_type=(
                    data.assignment_type.value if data.assignment_type else "Unknown"
                ),
                student_id=data.student_id,
                student_name=data.student_name,
                subject_id=data.subject_id,
                subject_name=data.subject_name,
                subject_color=data.subject_color,
                term_id=term_id_for_assignment,
                term_name=term_name_for_assignment,
                assigned_date=data.assigned_date,
                due_date=data.due_date,
                status=data.status.value if data.status else "Unknown",
                points_earned=data.points_earned,
                max_points=data.max_points,
                percentage_grade=data.percentage_grade,
                letter_grade=data.letter_grade,
                is_graded=data.is_graded,
                graded_date=data.graded_date,
                teacher_feedback=data.teacher_feedback,
                time_spent_minutes=data.time_spent_minutes or 0,
                assigned_by_name=data.assigned_by_name,
            )
        )

    # Calculate summary statistics
    total_assignments = len(assignments)
    graded_assignments = sum(1 for a in assignments if a.is_graded)
    pending_assignments = sum(
        1 for a in assignments if a.status in ["submitted", "completed"]
    )
    overdue_assignments = sum(1 for a in assignments if a.status == "overdue")

    # Calculate average grade
    graded_with_scores = [
        a for a in assignments if a.is_graded and a.percentage_grade is not None
    ]
    average_grade = (
        sum(a.percentage_grade for a in graded_with_scores) / len(graded_with_scores)
        if graded_with_scores
        else None
    )

    # Get unique counts
    subjects_count = len({a.subject_id for a in assignments})
    students_count = len({a.student_id for a in assignments})

    summary = schemas.AssignmentReportSummary(
        total_assignments=total_assignments,
        graded_assignments=graded_assignments,
        pending_assignments=pending_assignments,
        overdue_assignments=overdue_assignments,
        average_grade=round(average_grade, 2) if average_grade else None,
        subjects_count=subjects_count,
        students_count=students_count,
    )

    # Get available filter options
    base_student_query = db.query(
        User.id, func.concat(User.first_name, " ", User.last_name).label("name")
    ).filter(User.role == UserRole.STUDENT)
    # Note: No admin filtering in homeschool context - all admins can see all students

    available_subjects = [
        {"id": s.id, "name": s.name, "color": s.color}
        for s in db.query(Subject).order_by(Subject.name).all()
    ]

    available_students = [
        {"id": s.id, "name": s.name}
        for s in base_student_query.order_by(User.first_name, User.last_name).all()
    ]

    available_terms = [
        {"id": t.id, "name": t.name, "academic_year": t.academic_year}
        for t in db.query(Term).order_by(Term.start_date.desc()).all()
    ]

    return schemas.AssignmentReport(
        summary=summary,
        assignments=assignments,
        available_subjects=available_subjects,
        available_students=available_students,
        available_terms=available_terms,
    )


def calculate_letter_grade(percentage: float) -> str:
    """Calculate letter grade from percentage."""
    if percentage >= 97:
        return "A+"
    if percentage >= 93:
        return "A"
    if percentage >= 90:
        return "A-"
    if percentage >= 87:
        return "B+"
    if percentage >= 83:
        return "B"
    if percentage >= 80:
        return "B-"
    if percentage >= 77:
        return "C+"
    if percentage >= 73:
        return "C"
    if percentage >= 70:
        return "C-"
    if percentage >= 67:
        return "D+"
    if percentage >= 63:
        return "D"
    if percentage >= 60:
        return "D-"
    return "F"


@track_query_performance("get_report_card")
def get_report_card(
    db: Session, student_id: int, term_id: int
) -> schemas.ReportCard:
    """Generate a comprehensive report card for a student for a specific term."""
    # Get student information
    student = db.query(User).filter(
        User.id == student_id, User.role == UserRole.STUDENT
    ).first()
    if not student:
        raise ValueError("Student not found or access denied")

    # Get term information
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError("Term not found")

    # Get all assignments for this student in this term
    assignments_query = (
        db.query(StudentAssignment, AssignmentTemplate, Subject)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .join(Subject, AssignmentTemplate.subject_id == Subject.id)
        .filter(
            StudentAssignment.student_id == student_id,
            StudentAssignment.assigned_date >= term.start_date,
            StudentAssignment.assigned_date <= term.end_date,
        )
        .all()
    )

    # Group assignments by subject and calculate grades
    subject_grades = {}
    overall_stats = {
        "total_points_earned": 0.0,
        "total_points_possible": 0.0,
        "total_assignments": 0,
        "completed_assignments": 0,
    }

    for assignment, template, subject in assignments_query:
        if subject.id not in subject_grades:
            subject_grades[subject.id] = {
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_color": subject.color,
                "points_earned": 0.0,
                "points_possible": 0.0,
                "assignments_completed": 0,
                "assignments_total": 0,
            }

        subject_data = subject_grades[subject.id]
        max_points = assignment.custom_max_points or template.max_points

        subject_data["assignments_total"] += 1
        subject_data["points_possible"] += max_points
        overall_stats["total_assignments"] += 1
        overall_stats["total_points_possible"] += max_points

        if assignment.is_graded and assignment.points_earned is not None:
            subject_data["points_earned"] += assignment.points_earned
            subject_data["assignments_completed"] += 1
            overall_stats["total_points_earned"] += assignment.points_earned
            overall_stats["completed_assignments"] += 1

    # Calculate subject grades and letter grades
    report_card_subjects = []
    for _subject_id, data in subject_grades.items():
        if data["points_possible"] > 0:
            percentage = (data["points_earned"] / data["points_possible"]) * 100
        else:
            percentage = 0.0

        letter_grade = calculate_letter_grade(percentage)

        report_card_subjects.append(
            schemas.ReportCardSubjectGrade(
                subject_id=data["subject_id"],
                subject_name=data["subject_name"],
                subject_color=data["subject_color"],
                assignments_completed=data["assignments_completed"],
                assignments_total=data["assignments_total"],
                points_earned=data["points_earned"],
                points_possible=data["points_possible"],
                percentage_grade=round(percentage, 2),
                letter_grade=letter_grade,
            )
        )

    # Calculate overall grade
    if overall_stats["total_points_possible"] > 0:
        overall_percentage = (
            overall_stats["total_points_earned"]
            / overall_stats["total_points_possible"]
        ) * 100
    else:
        overall_percentage = 0.0

    overall_letter_grade = calculate_letter_grade(overall_percentage)

    # Get attendance data for the term (optional)
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= term.start_date,
            AttendanceRecord.date <= term.end_date,
        )
        .all()
    )

    days_present = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.PRESENT
    )
    days_absent = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.ABSENT
    )
    days_late = sum(1 for r in attendance_records if r.status == AttendanceStatus.LATE)
    days_excused = sum(
        1 for r in attendance_records if r.status == AttendanceStatus.EXCUSED
    )

    total_days_recorded = len(attendance_records)
    attendance_rate = (
        ((days_present + days_late + days_excused) / total_days_recorded * 100)
        if total_days_recorded > 0
        else None
    )

    # Create summary
    summary = schemas.ReportCardSummary(
        overall_percentage=round(overall_percentage, 2),
        overall_letter_grade=overall_letter_grade,
        total_assignments=overall_stats["total_assignments"],
        completed_assignments=overall_stats["completed_assignments"],
        subjects_count=len(subject_grades),
        attendance_rate=round(attendance_rate, 2) if attendance_rate else None,
        days_present=days_present,
        days_absent=days_absent,
        days_late=days_late,
    )

    # Get student's grade level from student profile if available
    student_profile = db.query(User).filter(User.id == student_id).first()
    grade_level = getattr(student_profile, "grade_level", None)

    # Find next term for information
    next_term = (
        db.query(Term)
        .filter(
            Term.start_date > term.end_date, Term.academic_year == term.academic_year
        )
        .order_by(Term.start_date)
        .first()
    )

    if not next_term:
        # Look for next academic year
        next_term = (
            db.query(Term)
            .filter(Term.academic_year > term.academic_year)
            .order_by(Term.academic_year, Term.start_date)
            .first()
        )

    next_term_info = (
        f"Next term: {next_term.name}" if next_term else "End of academic year"
    )

    return schemas.ReportCard(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        student_grade_level=grade_level,
        term_id=term.id,
        term_name=term.name,
        academic_year=term.academic_year,
        term_start_date=term.start_date,
        term_end_date=term.end_date,
        generated_date=date.today(),
        summary=summary,
        subject_grades=report_card_subjects,
        next_term_info=next_term_info,
    )