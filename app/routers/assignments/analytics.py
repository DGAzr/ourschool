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
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.subject import Subject

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

    # Aggregate scalar columns only; retain the existing all-work denominator.
    graded = StudentAssignment.is_graded.is_(
        True
    ) & StudentAssignment.points_earned.is_not(None)
    rows = (
        db.query(
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            Subject.color.label("subject_color"),
            func.count(StudentAssignment.id).label("total_assignments"),
            func.count(StudentAssignment.id)
            .filter(graded)
            .label("completed_assignments"),
            func.coalesce(
                func.sum(StudentAssignment.points_earned).filter(graded), 0
            ).label("total_points_earned"),
            func.sum(
                func.coalesce(
                    func.nullif(StudentAssignment.custom_max_points, 0),
                    func.nullif(AssignmentTemplate.max_points, 0),
                    100,
                )
            ).label("total_points_possible"),
        )
        .select_from(StudentAssignment)
        .join(AssignmentTemplate)
        .join(Subject)
        .filter(StudentAssignment.student_id == student_id)
        .group_by(Subject.id)
        .order_by(Subject.id)
        .all()
    )
    subjects_data = {row.subject_id: dict(row._mapping) for row in rows}
    total_assignments = sum(row.total_assignments for row in rows)
    total_completed = sum(row.completed_assignments for row in rows)
    total_points_earned = sum(row.total_points_earned for row in rows)
    total_points_possible = sum(row.total_points_possible for row in rows)

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
    a = StudentAssignment
    if current_user.role == UserRole.ADMIN:
        rows = (
            db.query(
                User.id,
                User.first_name,
                User.last_name,
                func.count(a.id).label("total"),
                func.count(a.id).filter(a.is_graded).label("completed"),
                func.count(a.id)
                .filter(
                    (a.status == AssignmentStatus.SUBMITTED) & a.is_graded.is_(False)
                )
                .label("pending"),
                func.count(a.id)
                .filter(
                    a.status.in_(
                        [AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS]
                    )
                )
                .label("active"),
            )
            .outerjoin(a, a.student_id == User.id)
            .filter(User.role == UserRole.STUDENT)
            .group_by(User.id)
            .order_by(User.id)
            .all()
        )
        return {
            "total_students": len(rows),
            "total_templates": db.query(func.count(AssignmentTemplate.id)).scalar(),
            "active_assignments": sum(r.active for r in rows),
            "pending_grades": sum(r.pending for r in rows),
            "students": [
                dict(
                    id=r.id,
                    name=f"{r.first_name} {r.last_name}",
                    total_assignments=r.total,
                    completed_assignments=r.completed,
                    pending_grades=r.pending,
                )
                for r in rows
            ],
        }

    total, completed, in_progress, overdue = (
        db.query(
            func.count(a.id),
            func.count(a.id).filter(a.is_graded),
            func.count(a.id).filter(a.status == AssignmentStatus.IN_PROGRESS),
            func.count(a.id).filter(a.status == AssignmentStatus.OVERDUE),
        )
        .filter(a.student_id == current_user.id)
        .one()
    )
    return {
        "total_assignments": total,
        "completed_assignments": completed,
        "in_progress_assignments": in_progress,
        "overdue_assignments": overdue,
        "upcoming_due": db.query(a)
        .filter(
            a.student_id == current_user.id,
            a.due_date >= date.today(),
            a.status.in_([AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS]),
        )
        .order_by(a.due_date, a.id)
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
