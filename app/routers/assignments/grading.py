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

"""Grading endpoints: single and bulk grading plus grading queues."""

import logging
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.crud.reports import calculate_letter_grade
from app.crud.settings import get_grade_scale
from app.models.assignment import (
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.user import User, UserRole
from app.core.dual_auth import (
    AuthUser,
    get_user_id_from_auth,
    require_admin_or_permission,
)
from app.crud import points as points_crud
from app.schemas.assignment import (
    BulkGradeItem,
    BulkGradeResult,
    StudentAssignmentGrade,
    StudentAssignmentResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/student-assignments/{assignment_id}/grade",
    response_model=StudentAssignmentResponse,
)
def grade_student_assignment(
    assignment_id: int,
    grade_data: StudentAssignmentGrade,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("assignments:grade"))],
):
    """Grade a student assignment."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    # Verify student exists (admin can manage any student)
    student = (
        db.query(User)
        .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Validate points don't exceed maximum
    max_points = assignment.max_points
    if grade_data.points_earned > max_points:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Points earned ({grade_data.points_earned}) "
                f"cannot exceed maximum points ({max_points})"
            ),
        )

    # Update grade
    assignment.points_earned = grade_data.points_earned
    assignment.teacher_feedback = grade_data.teacher_feedback
    assignment.letter_grade = grade_data.letter_grade
    assignment.is_graded = True
    assignment.graded_date = date.today()
    assignment.graded_by = get_user_id_from_auth(auth_user)

    # Calculate percentage
    percentage = assignment.calculate_percentage_grade()

    # Assign letter grade if not provided
    if not grade_data.letter_grade and percentage is not None:
        assignment.letter_grade = calculate_letter_grade(
            percentage, get_grade_scale(db)
        )
    else:
        assignment.letter_grade = grade_data.letter_grade

    assignment.update_status()

    # Automatically update term grades
    assignment.update_term_grade(db)

    db.commit()
    db.refresh(assignment)

    # Sync points if points system is enabled (idempotent; safe on re-grade)
    try:
        if points_crud.is_points_system_enabled(db):
            assignment_title = (
                f"{assignment.template.name}"
                if assignment.template
                else f"Assignment {assignment.id}"
            )
            points_crud.set_assignment_points(
                db=db,
                student_id=assignment.student_id,
                assignment_id=assignment.id,
                points_earned=grade_data.points_earned,
                assignment_title=assignment_title,
            )
            db.commit()
            logger.info(
                "Synced points for student %s assignment %s to %s",
                assignment.student_id,
                assignment.id,
                grade_data.points_earned,
            )
    except Exception as e:
        # Don't fail the grading process if points syncing fails
        db.rollback()
        logger.error(
            "Failed to sync points for assignment %s: %s",
            assignment.id,
            str(e),
        )

    logger.info(
        "Graded assignment %s with %s/%s points",
        assignment.id,
        grade_data.points_earned,
        max_points,
    )

    return assignment


@router.post("/bulk-grade", response_model=list[BulkGradeResult])
def bulk_grade_assignments(
    items: list[BulkGradeItem],
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("assignments:grade"))],
):
    """Grade multiple student assignments in one request. Each item is graded independently; one failure does not roll back others."""
    results: list[BulkGradeResult] = []
    points_enabled = points_crud.is_points_system_enabled(db)
    for item in items:
        try:
            assignment = (
                db.query(StudentAssignment)
                .filter(StudentAssignment.id == item.assignment_id)
                .first()
            )
            if not assignment:
                results.append(
                    BulkGradeResult(
                        assignment_id=item.assignment_id,
                        success=False,
                        error="Assignment not found",
                    )
                )
                continue

            max_points = assignment.max_points
            if item.points_earned > max_points:
                results.append(
                    BulkGradeResult(
                        assignment_id=item.assignment_id,
                        success=False,
                        error=f"Points {item.points_earned} exceed maximum {max_points}",
                    )
                )
                continue

            # Each item commits or rolls back independently via a savepoint, so
            # one failure never discards previously-applied items.
            with db.begin_nested():
                assignment.points_earned = item.points_earned
                assignment.teacher_feedback = item.teacher_feedback
                assignment.is_graded = True
                assignment.graded_date = date.today()
                assignment.graded_by = get_user_id_from_auth(auth_user)

                percentage = assignment.calculate_percentage_grade()
                if percentage is not None:
                    assignment.letter_grade = calculate_letter_grade(
                        percentage, get_grade_scale(db)
                    )

                assignment.update_status()
                assignment.update_term_grade(db)

                if points_enabled:
                    title = (
                        assignment.template.name
                        if assignment.template
                        else f"Assignment {assignment.id}"
                    )
                    # Idempotent delta sync handles both first grade and re-grade.
                    points_crud.set_assignment_points(
                        db=db,
                        student_id=assignment.student_id,
                        assignment_id=assignment.id,
                        points_earned=item.points_earned,
                        assignment_title=title,
                    )

            results.append(
                BulkGradeResult(assignment_id=item.assignment_id, success=True)
            )
        except Exception as e:
            results.append(
                BulkGradeResult(
                    assignment_id=item.assignment_id, success=False, error=str(e)
                )
            )

    db.commit()
    return results


@router.get("/submitted", response_model=List[StudentAssignmentResponse])
def get_submitted_assignments(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("assignments:read"))],
    status: Optional[str] = Query(None),
    subject_id: Optional[int] = Query(None),
):
    """Get submitted assignments for grading (Admin only)."""

    # Start with assignments for students managed by this admin
    # We need to explicitly specify the join condition
    # since there are multiple FKs to users table
    query = (
        db.query(StudentAssignment)
        .join(User, StudentAssignment.student_id == User.id)
        .filter(
            User.role == UserRole.STUDENT,
            StudentAssignment.status
            == AssignmentStatus.SUBMITTED,  # Default to submitted for grading
        )
        .options(
            joinedload(StudentAssignment.template),
            joinedload(StudentAssignment.student),
        )
    )

    # Apply filters
    if status:
        # Convert string status to enum
        try:
            status_enum = AssignmentStatus(status)
            query = query.filter(StudentAssignment.status == status_enum)
        except ValueError:
            # Invalid status, return empty results
            return []

    if subject_id:
        query = query.join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        ).filter(AssignmentTemplate.subject_id == subject_id)

    # Order by submission date (most recent first)
    assignments = query.order_by(StudentAssignment.submitted_date.desc()).all()

    return assignments


@router.get("/all-assignments", response_model=List[StudentAssignmentResponse])
def get_all_assignments_for_grading(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:read"))
    ],
    status: Optional[str] = Query(None),
    subject_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
):
    """Get all student assignments for grading/discovery.

    Accessible by admin sessions and API keys with assignments:read. This is the
    primary endpoint an external workflow uses to discover assignments (e.g.
    filtering by ``status=submitted`` and ``student_id``) before grading them.
    """
    # Start with assignments for all students
    query = (
        db.query(StudentAssignment)
        .join(User, StudentAssignment.student_id == User.id)
        .filter(User.role == UserRole.STUDENT)
        .options(
            joinedload(StudentAssignment.template).joinedload(
                AssignmentTemplate.subject
            ),
            joinedload(StudentAssignment.student),
        )
    )

    # Apply filters
    if status:
        # Convert string status to enum
        try:
            status_enum = AssignmentStatus(status)
            query = query.filter(StudentAssignment.status == status_enum)
        except ValueError:
            # Invalid status, return empty results
            return []

    if subject_id:
        query = query.join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        ).filter(AssignmentTemplate.subject_id == subject_id)

    if student_id:
        query = query.filter(StudentAssignment.student_id == student_id)

    # Order by assigned date (most recent first), then by due date
    assignments = query.order_by(
        StudentAssignment.assigned_date.desc(), StudentAssignment.due_date.asc()
    ).all()

    return assignments
