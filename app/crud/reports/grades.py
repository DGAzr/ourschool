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


"""CRUD operations for term grades, subject performance, and report cards."""

from datetime import date
from typing import Optional

from app.models.assignment import (
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.attendance import AttendanceRecord
from app.models.subject import Subject
from app.models.term import Term
from app.models.user import User, UserRole
from sqlalchemy.orm import Session, joinedload
from app.crud import settings as crud_settings
from app.schemas import reports as schemas
from app.utils.attendance import calculate_attendance_rate, get_attendance_statistics
from app.utils.grading import (
    calculate_letter_grade,
    compute_weighted_grade,
    term_membership_filter,
)
from app.utils.performance import track_query_performance

from app.crud.reports.shared import _grade_item, _is_graded


def get_student_term_grades(
    db: Session, student_id: int, term_id: Optional[int] = None
):
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

    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)

    assignments = (
        db.query(StudentAssignment)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .filter(
            StudentAssignment.student_id == student_id,
            term_membership_filter(active_term),
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
                "assignments_count": 0,
                "completed_count": 0,
                "graded_items": [],
            }

        subject_grades[subject.id]["assignments_count"] += 1
        if assign.status == AssignmentStatus.GRADED:
            subject_grades[subject.id]["completed_count"] += 1

        # Only graded assignments contribute to the grade — ungraded ones
        # shouldn't count as 0 earned and unfairly lower the percentage.
        if _is_graded(assign):
            subject_grades[subject.id]["graded_items"].append(_grade_item(assign))

    result = []
    for _subject_id, data in subject_grades.items():
        earned_points, total_points, percentage = compute_weighted_grade(
            data.pop("graded_items"), type_weights
        )
        data["earned_points"] = earned_points
        data["total_points"] = total_points

        letter_grade = calculate_letter_grade(percentage, grade_scale)

        result.append(
            schemas.TermGrade(
                **data, percentage=round(percentage, 2), letter_grade=letter_grade
            )
        )

    return result


def _calculate_subject_trend_data(
    db: Session, student_id: int, subject_id: int, term_id: Optional[int] = None
):
    """Calculate trend data for a specific subject."""

    # Build query for graded assignments in this subject
    query = (
        db.query(StudentAssignment)
        .join(AssignmentTemplate)
        .filter(
            StudentAssignment.student_id == student_id,
            AssignmentTemplate.subject_id == subject_id,
            StudentAssignment.is_graded,
            StudentAssignment.percentage_grade.isnot(None),
            StudentAssignment.graded_date.isnot(None),
        )
    )

    # Filter by term if specified (membership by effective due date)
    if term_id:
        term = db.query(Term).filter(Term.id == term_id).first()
        if term:
            query = query.filter(term_membership_filter(term))

    # Get assignments ordered by graded date
    assignments = query.order_by(StudentAssignment.graded_date).all()

    if len(assignments) < 2:
        # Not enough data for trend, return current grade if available
        if assignments:
            return [
                schemas.TrendDataPoint(
                    date=assignments[0].graded_date.isoformat(),
                    average_grade=assignments[0].percentage_grade,
                    assignments_count=1,
                )
            ]
        return []

    # Create trend buckets - aim for 4-5 data points
    num_buckets = min(5, len(assignments))
    bucket_size = max(1, len(assignments) // num_buckets)

    trend_data = []
    for i in range(0, len(assignments), bucket_size):
        bucket_assignments = assignments[i : i + bucket_size]
        if bucket_assignments:
            avg_grade = sum(a.percentage_grade for a in bucket_assignments) / len(
                bucket_assignments
            )
            # Use the latest date in the bucket
            latest_date = max(a.graded_date for a in bucket_assignments)

            trend_data.append(
                schemas.TrendDataPoint(
                    date=latest_date.isoformat(),
                    average_grade=round(avg_grade, 2),
                    assignments_count=len(bucket_assignments),
                )
            )

    # Ensure we don't have more than 5 data points
    if len(trend_data) > 5:
        # Take evenly distributed points
        indices = [int(i * (len(trend_data) - 1) / 4) for i in range(5)]
        trend_data = [trend_data[i] for i in indices]

    return trend_data


def get_student_subject_performance(
    db: Session, student_id: int, term_id: Optional[int] = None
):
    """Get a student's performance by subject, optionally filtered by term."""
    grade_scale = crud_settings.get_grade_scale(db)
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
        subj_data["terms"].append(grade)

    result = []
    for _subject_id, data in term_grades_by_subject.items():
        # Roll terms up by point volume rather than averaging per-term
        # percentages, so a low-volume term doesn't count as much as a
        # high-volume one. Each term percentage is already type-weighted.
        points_earned = sum(term.earned_points for term in data["terms"])
        points_possible = sum(term.total_points for term in data["terms"])
        if points_possible > 0:
            avg_percentage = (
                sum(term.percentage * term.total_points for term in data["terms"])
                / points_possible
            )
        else:
            avg_percentage = 0.0

        # Calculate trend data for this subject
        trend_data = _calculate_subject_trend_data(
            db, student_id, data["subject_id"], term_id
        )

        result.append(
            schemas.SubjectPerformance(
                subject_id=data["subject_id"],
                subject_name=data["subject_name"],
                average_percentage=round(avg_percentage, 2),
                letter_grade=calculate_letter_grade(avg_percentage, grade_scale),
                total_assignments=data["total_assignments"],
                completed_assignments=data["completed_assignments"],
                points_earned=points_earned,
                points_possible=points_possible,
                terms=data["terms"],
                trend_data=trend_data,
            )
        )

    return result


@track_query_performance("get_report_card")
def get_report_card(db: Session, student_id: int, term_id: int) -> schemas.ReportCard:
    """Generate a comprehensive report card for a student for a specific term."""
    # Get student information
    student = (
        db.query(User)
        .filter(User.id == student_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise ValueError("Student not found or access denied")

    # Get term information
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError("Term not found")

    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)

    # Get all assignments for this student in this term (membership by due date)
    assignments_query = (
        db.query(StudentAssignment, AssignmentTemplate, Subject)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .join(Subject, AssignmentTemplate.subject_id == Subject.id)
        .filter(
            StudentAssignment.student_id == student_id,
            term_membership_filter(term),
        )
        .all()
    )

    # Group assignments by subject and collect graded items
    subject_grades = {}
    overall_items = []
    overall_total_assignments = 0
    overall_completed = 0

    for assignment, template, subject in assignments_query:
        if subject.id not in subject_grades:
            subject_grades[subject.id] = {
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_color": subject.color,
                "assignments_completed": 0,
                "assignments_total": 0,
                "graded_items": [],
            }

        subject_data = subject_grades[subject.id]
        subject_data["assignments_total"] += 1
        overall_total_assignments += 1

        # Only graded assignments contribute to the grade — ungraded ones
        # should not count against the student's percentage.
        if _is_graded(assignment):
            item = (
                assignment.points_earned,
                assignment.custom_max_points or template.max_points,
                template.assignment_type,
            )
            subject_data["graded_items"].append(item)
            subject_data["assignments_completed"] += 1
            overall_items.append(item)
            overall_completed += 1

    # Calculate subject grades and letter grades
    report_card_subjects = []
    for _subject_id, data in subject_grades.items():
        points_earned, points_possible, percentage = compute_weighted_grade(
            data["graded_items"], type_weights
        )

        report_card_subjects.append(
            schemas.ReportCardSubjectGrade(
                subject_id=data["subject_id"],
                subject_name=data["subject_name"],
                subject_color=data["subject_color"],
                assignments_completed=data["assignments_completed"],
                assignments_total=data["assignments_total"],
                points_earned=points_earned,
                points_possible=points_possible,
                percentage_grade=round(percentage, 2),
                letter_grade=calculate_letter_grade(percentage, grade_scale),
            )
        )

    # Calculate overall grade
    _, _, overall_percentage = compute_weighted_grade(overall_items, type_weights)
    overall_letter_grade = calculate_letter_grade(overall_percentage, grade_scale)

    # Get attendance data for the term (attended / recorded days)
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= term.start_date,
            AttendanceRecord.date <= term.end_date,
        )
        .all()
    )

    attendance_stats = get_attendance_statistics(attendance_records)
    days_present = attendance_stats["present_days"]
    days_absent = attendance_stats["absent_days"]
    days_late = attendance_stats["late_days"]
    attendance_rate = calculate_attendance_rate(attendance_records)

    # Create summary
    summary = schemas.ReportCardSummary(
        overall_percentage=round(overall_percentage, 2),
        overall_letter_grade=overall_letter_grade,
        total_assignments=overall_total_assignments,
        completed_assignments=overall_completed,
        subjects_count=len(subject_grades),
        attendance_rate=(
            round(attendance_rate, 2) if attendance_rate is not None else None
        ),
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
