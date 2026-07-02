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

"""Assignment analytics endpoints: progress, dashboard, and term grades."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.crud import reports as crud_reports
from app.models.assignment import (
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.term import Term
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.core.dual_auth import (
    AuthUser,
    get_user_id_from_auth,
    is_admin_user,
    require_user_or_permission,
)
from app.schemas.assignment import (
    StudentProgressSummary,
    SubjectProgressResponse,
)

router = APIRouter()


# Progress and Analytics


@router.get("/students/{student_id}/progress", response_model=StudentProgressSummary)
def get_student_progress(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_user_or_permission("assignments:read"))
    ],
):
    """Get comprehensive progress summary for a student.

    Admins and API keys (assignments:read) may view any student; student
    sessions may only view their own progress.
    """
    # Verify access. API keys have no user id → treated as privileged readers.
    requester_id = get_user_id_from_auth(auth_user)
    if is_admin_user(auth_user) or requester_id is None:
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    elif requester_id != student_id:
        raise HTTPException(
            status_code=403, detail="Students can only view their own progress"
        )
    else:
        student = auth_user

    # Get all assignments for this student grouped by subject
    assignments = (
        db.query(StudentAssignment)
        .options(
            joinedload(StudentAssignment.template).joinedload(
                AssignmentTemplate.subject
            )
        )
        .filter(StudentAssignment.student_id == student_id)
        .all()
    )

    # Group by subject
    subjects_data = {}
    total_assignments = len(assignments)
    total_completed = 0
    total_points_earned = 0
    total_points_possible = 0

    for assignment in assignments:
        subject = assignment.template.subject
        subject_id = subject.id

        if subject_id not in subjects_data:
            subjects_data[subject_id] = {
                "subject_id": subject_id,
                "subject_name": subject.name,
                "subject_color": subject.color,
                "total_assignments": 0,
                "completed_assignments": 0,
                "total_points_earned": 0,
                "total_points_possible": 0,
            }

        subjects_data[subject_id]["total_assignments"] += 1
        subjects_data[subject_id]["total_points_possible"] += assignment.max_points

        if assignment.is_graded and assignment.points_earned is not None:
            subjects_data[subject_id]["completed_assignments"] += 1
            subjects_data[subject_id]["total_points_earned"] += assignment.points_earned
            total_completed += 1
            total_points_earned += assignment.points_earned

        total_points_possible += assignment.max_points

    # Calculate subject progress
    subject_progress = []
    for subject_data in subjects_data.values():
        avg_grade = None
        if subject_data["total_points_possible"] > 0:
            avg_grade = (
                subject_data["total_points_earned"]
                / subject_data["total_points_possible"]
            ) * 100

        completion_pct = 0
        if subject_data["total_assignments"] > 0:
            completion_pct = (
                subject_data["completed_assignments"]
                / subject_data["total_assignments"]
            ) * 100

        subject_progress.append(
            SubjectProgressResponse(
                subject_id=subject_data["subject_id"],
                subject_name=subject_data["subject_name"],
                subject_color=subject_data["subject_color"],
                total_assignments=subject_data["total_assignments"],
                completed_assignments=subject_data["completed_assignments"],
                average_grade=avg_grade,
                completion_percentage=completion_pct,
            )
        )

    # Calculate overall average
    overall_average = None
    if total_points_possible > 0:
        overall_average = (total_points_earned / total_points_possible) * 100

    return StudentProgressSummary(
        student_id=student_id,
        student_name=f"{student.first_name} {student.last_name}",
        total_assignments=total_assignments,
        completed_assignments=total_completed,
        average_grade=overall_average,
        subjects=subject_progress,
    )


@router.get("/dashboard/overview")
def get_assignment_dashboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get assignment dashboard overview for admin or student."""
    if current_user.role == UserRole.ADMIN:
        # Admin dashboard - overview of all managed students
        students = db.query(User).filter(User.role == UserRole.STUDENT).all()

        dashboard_data = {
            "total_students": len(students),
            "total_templates": db.query(AssignmentTemplate).count(),
            "active_assignments": db.query(StudentAssignment)
            .join(User, StudentAssignment.student_id == User.id)
            .filter(
                User.role == UserRole.STUDENT,
                StudentAssignment.status.in_(
                    [AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS]
                ),
            )
            .count(),
            "pending_grades": db.query(StudentAssignment)
            .join(User, StudentAssignment.student_id == User.id)
            .filter(
                User.role == UserRole.STUDENT,
                StudentAssignment.status == AssignmentStatus.SUBMITTED,
                StudentAssignment.is_graded.is_(False),
            )
            .count(),
            "students": [],
        }

        for student in students:
            student_assignments = (
                db.query(StudentAssignment)
                .filter(StudentAssignment.student_id == student.id)
                .all()
            )

            total = len(student_assignments)
            completed = len([a for a in student_assignments if a.is_graded])
            pending = len(
                [
                    a
                    for a in student_assignments
                    if a.status == AssignmentStatus.SUBMITTED and not a.is_graded
                ]
            )

            dashboard_data["students"].append(
                {
                    "id": student.id,
                    "name": f"{student.first_name} {student.last_name}",
                    "total_assignments": total,
                    "completed_assignments": completed,
                    "pending_grades": pending,
                }
            )

        return dashboard_data

    # Student dashboard
    assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.student_id == current_user.id)
        .all()
    )

    total = len(assignments)
    completed = len([a for a in assignments if a.is_graded])
    in_progress = len(
        [a for a in assignments if a.status == AssignmentStatus.IN_PROGRESS]
    )
    overdue = len([a for a in assignments if a.status == AssignmentStatus.OVERDUE])

    return {
        "total_assignments": total,
        "completed_assignments": completed,
        "in_progress_assignments": in_progress,
        "overdue_assignments": overdue,
        "upcoming_due": db.query(StudentAssignment)
        .filter(
            StudentAssignment.student_id == current_user.id,
            StudentAssignment.due_date >= date.today(),
            StudentAssignment.status.in_(
                [AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS]
            ),
        )
        .order_by(StudentAssignment.due_date.asc())
        .limit(5)
        .all(),
    }


@router.get("/student-term-grades/{student_id}")
def get_student_term_grades(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get term grades for a specific student, across all terms.

    Delegates per-term computation to the canonical reporting CRUD so that term
    membership (by effective due date), per-assignment-type weighting, and the
    shared letter-grade scale match every other grade surface in the app.
    """
    # Verify access - admin must manage the student, or student can see their own
    if current_user.role == UserRole.ADMIN:
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.STUDENT:
        if current_user.id != student_id:
            raise HTTPException(
                status_code=403, detail="Students can only view their own grades"
            )
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    terms = db.query(Term).order_by(Term.term_order).all()

    result = []
    for term in terms:
        for tg in crud_reports.get_student_term_grades(db, student_id, term_id=term.id):
            result.append(
                {
                    "term_id": tg.term_id,
                    "term_name": tg.term_name,
                    "subject_id": tg.subject_id,
                    "subject_name": tg.subject_name,
                    "total_points": tg.total_points,
                    "earned_points": tg.earned_points,
                    "percentage": tg.percentage,
                    "letter_grade": tg.letter_grade,
                    "assignments_count": tg.assignments_count,
                    "completed_count": tg.completed_count,
                }
            )

    return result


@router.get("/my-term-grades")
def get_my_term_grades(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get term grades for the current user."""
    return get_student_term_grades(current_user.id, db, current_user)
