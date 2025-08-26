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

"""External API endpoints for integrations."""

import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.api_auth import require_permission
from app.core.database import get_db
from app.models.assignment import StudentAssignment
from app.models.user import User, UserRole
from app.schemas.assignment import StudentAssignmentGrade

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/assignments/{assignment_id}/grade")
def grade_assignment_via_api(
    assignment_id: int,
    grade_data: StudentAssignmentGrade,
    db: Annotated[Session, Depends(get_db)],
    api_key_user: Annotated[object, Depends(require_permission("assignments:grade"))],
):
    """
    Grade a student assignment via external API.
    
    This endpoint allows external systems to submit grades for student assignments
    using API key authentication. The API key must have the 'assignments:grade' permission.
    
    Args:
        assignment_id: ID of the student assignment to grade
        grade_data: Grade information including points earned and feedback
        db: Database session
        api_key_user: Authenticated API key user with grading permissions
        
    Returns:
        Graded assignment data
        
    Raises:
        HTTPException: 404 if assignment not found
        HTTPException: 400 if points exceed maximum or other validation fails
    """
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

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
    
    # For API grading, we'll set graded_by to None since it's not a user
    # but we'll track it in the logs
    assignment.graded_by = None

    # Calculate percentage
    percentage = assignment.calculate_percentage_grade()

    # Assign letter grade if not provided
    if not grade_data.letter_grade and percentage is not None:
        if percentage >= 97:
            letter_grade = "A+"
        elif percentage >= 93:
            letter_grade = "A"
        elif percentage >= 90:
            letter_grade = "A-"
        elif percentage >= 87:
            letter_grade = "B+"
        elif percentage >= 83:
            letter_grade = "B"
        elif percentage >= 80:
            letter_grade = "B-"
        elif percentage >= 77:
            letter_grade = "C+"
        elif percentage >= 73:
            letter_grade = "C"
        elif percentage >= 70:
            letter_grade = "C-"
        elif percentage >= 67:
            letter_grade = "D+"
        elif percentage >= 65:
            letter_grade = "D"
        else:
            letter_grade = "F"
        assignment.letter_grade = letter_grade
    else:
        assignment.letter_grade = grade_data.letter_grade

    assignment.update_status()

    # Automatically update term grades
    assignment.update_term_grade(db)

    db.commit()
    db.refresh(assignment)

    # Award points if points system is enabled
    try:
        from app.crud import points as points_crud
        if points_crud.is_points_system_enabled(db):
            assignment_title = f"{assignment.template.name}" if assignment.template else f"Assignment {assignment.id}"
            points_crud.award_assignment_points(
                db=db,
                student_id=assignment.student_id,
                assignment_id=assignment.id,
                points_earned=grade_data.points_earned,
                assignment_title=assignment_title
            )
            logger.info(
                "Awarded %s points to student %s for assignment %s via API",
                grade_data.points_earned,
                assignment.student_id,
                assignment.id,
                extra={"api_key": api_key_user.name}
            )
    except Exception as e:
        # Don't fail the grading process if points awarding fails
        logger.error(
            "Failed to award points for assignment %s via API: %s",
            assignment.id,
            str(e),
            extra={"api_key": api_key_user.name}
        )

    logger.info(
        "Graded assignment %s with %s/%s points via API",
        assignment.id,
        grade_data.points_earned,
        max_points,
        extra={"api_key": api_key_user.name}
    )

    # Return the assignment data - we need to manually construct the response
    # since we can't easily return the full StudentAssignmentResponse without
    # including template data
    return {
        "id": assignment.id,
        "template_id": assignment.template_id,
        "student_id": assignment.student_id,
        "assigned_date": assignment.assigned_date,
        "due_date": assignment.due_date,
        "status": assignment.status,
        "points_earned": assignment.points_earned,
        "percentage_grade": assignment.percentage_grade,
        "letter_grade": assignment.letter_grade,
        "is_graded": assignment.is_graded,
        "graded_date": assignment.graded_date,
        "teacher_feedback": assignment.teacher_feedback,
        "max_points": assignment.max_points,
    }


@router.get("/assignments/{assignment_id}")
def get_assignment_via_api(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    api_key_user: Annotated[object, Depends(require_permission("assignments:read"))],
):
    """
    Get assignment details via external API.
    
    This endpoint allows external systems to retrieve assignment information
    using API key authentication. The API key must have the 'assignments:read' permission.
    
    Args:
        assignment_id: ID of the student assignment
        db: Database session
        api_key_user: Authenticated API key user with read permissions
        
    Returns:
        Assignment data
        
    Raises:
        HTTPException: 404 if assignment not found
    """
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    logger.info(
        "Retrieved assignment %s via API",
        assignment.id,
        extra={"api_key": api_key_user.name}
    )

    return {
        "id": assignment.id,
        "template_id": assignment.template_id,
        "student_id": assignment.student_id,
        "assigned_date": assignment.assigned_date,
        "due_date": assignment.due_date,
        "status": assignment.status,
        "points_earned": assignment.points_earned,
        "percentage_grade": assignment.percentage_grade,
        "letter_grade": assignment.letter_grade,
        "is_graded": assignment.is_graded,
        "graded_date": assignment.graded_date,
        "teacher_feedback": assignment.teacher_feedback,
        "student_notes": assignment.student_notes,
        "submission_notes": assignment.submission_notes,
        "max_points": assignment.max_points,
        "custom_instructions": assignment.custom_instructions,
        "started_date": assignment.started_date,
        "completed_date": assignment.completed_date,
        "submitted_date": assignment.submitted_date,
    }