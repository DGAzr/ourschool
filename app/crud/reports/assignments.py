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


"""CRUD operations for assignment reports."""

from typing import Optional

from app.models.assignment import (
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.subject import Subject
from app.models.term import Term
from app.models.user import User, UserRole
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.schemas import reports as schemas
from app.utils.grading import term_membership_filter
from app.utils.performance import track_query_performance


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
            query = query.filter(term_membership_filter(term))

    if status:
        query = query.filter(StudentAssignment.status == status)

    # Execute query and get results
    assignment_data = query.order_by(StudentAssignment.assigned_date.desc()).all()

    # Pre-fetch all terms once for efficient date-range lookup
    all_terms = db.query(Term).all()

    def _find_term_for_date(d):
        """Find term containing date d using linear scan over terms."""
        if not d:
            return None, None
        for t in all_terms:
            if t.start_date <= d <= t.end_date:
                return t.id, t.name
        return None, None

    # Build assignment list
    assignments = []

    for data in assignment_data:
        # Tag with the term containing the effective due date (due_date or assigned_date)
        term_id_for_assignment, term_name_for_assignment = _find_term_for_date(
            data.due_date or data.assigned_date
        )

        assignments.append(
            schemas.AssignmentReportItem(
                assignment_id=data.assignment_id,
                template_id=data.template_id,
                assignment_name=data.assignment_name,
                assignment_type=(
                    data.assignment_type if data.assignment_type else "Unknown"
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
        1 for a in assignments if a.status == AssignmentStatus.SUBMITTED.value
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
