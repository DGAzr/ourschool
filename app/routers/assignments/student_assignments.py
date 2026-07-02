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

"""Student assignment endpoints: assigning templates and student assignment lifecycle."""

import json
import logging
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
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
    require_admin_or_permission,
)
from app.schemas.assignment import (
    AssignmentAssignmentRequest,
    AssignmentAssignmentResponse,
    StudentAssignmentResponse,
    StudentAssignmentUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Assignment Assignment (Assigning templates to students)


@router.post("/assign", response_model=AssignmentAssignmentResponse)
def assign_template_to_students(
    assignment_request: AssignmentAssignmentRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Assign an assignment template to multiple students (admin session or API key with assignments:write)."""
    # Find active term
    active_term = db.query(Term).filter(Term.is_active).first()
    if not active_term:
        raise HTTPException(
            status_code=400,
            detail="No active term found. "
            "Please set an active term before assigning assignments.",
        )

    # Verify template exists (admins and authorized API keys can use any template)
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == assignment_request.template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Verify all students exist (admins can assign to any student in homeschool)
    students = (
        db.query(User)
        .filter(
            User.id.in_(assignment_request.student_ids),
            User.role == UserRole.STUDENT,
            User.is_active,
        )
        .all()
    )

    found_student_ids = {student.id for student in students}
    missing_student_ids = set(assignment_request.student_ids) - found_student_ids

    if missing_student_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Students with IDs {list(missing_student_ids)} "
            "not found or access denied",
        )

    created_assignments = []
    failed_assignments = []

    # Use current date for assignment date, or the provided one
    assigned_date = assignment_request.assigned_date or date.today()
    assigned_by = get_user_id_from_auth(auth_user)  # None for API keys

    for student_id in assignment_request.student_ids:
        try:
            # Allow multiple assignments of the same template to the same student
            # (templates are reusable for practice, retakes, etc.)
            student_assignment = StudentAssignment(
                template_id=assignment_request.template_id,
                student_id=student_id,
                assigned_date=assigned_date,
                due_date=assignment_request.due_date,
                custom_instructions=assignment_request.custom_instructions,
                custom_max_points=assignment_request.custom_max_points,
                assigned_by=assigned_by,
            )

            db.add(student_assignment)
            created_assignments.append(student_assignment)

        except Exception as e:
            failed_assignments.append({"student_id": student_id, "error": str(e)})

    db.commit()

    # Refresh created assignments
    for assignment in created_assignments:
        db.refresh(assignment)

    logger.info(
        "Assigned template %s to %s students",
        assignment_request.template_id,
        len(created_assignments),
    )

    return AssignmentAssignmentResponse(
        success_count=len(created_assignments),
        failed_assignments=failed_assignments,
        created_assignments=created_assignments,
    )


# Student Assignment Management


@router.get(
    "/students/{student_id}/assignments", response_model=List[StudentAssignmentResponse]
)
def get_student_assignments(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    include_archived: bool = Query(False),
):
    """Get assignments for a specific student."""
    # Verify access - admin can see any student,
    # students can only see their own
    if current_user.role == UserRole.ADMIN:
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    elif current_user.role == UserRole.STUDENT and current_user.id != student_id:
        raise HTTPException(
            status_code=403, detail="Students can only view their own assignments"
        )

    query = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.template))
        .filter(StudentAssignment.student_id == student_id)
    )

    if not include_archived:
        query = query.filter(StudentAssignment.status != AssignmentStatus.EXCUSED)

    if subject_id:
        query = query.join(AssignmentTemplate).filter(
            AssignmentTemplate.subject_id == subject_id
        )

    if status:
        query = query.filter(StudentAssignment.status == status)

    assignments = query.all()
    return assignments


@router.get(
    "/student-assignments/{assignment_id}", response_model=StudentAssignmentResponse
)
def get_student_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific student assignment by ID."""
    assignment = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.template))
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    # Verify access
    if current_user.role == UserRole.ADMIN:
        # Admin can view any assignment
        pass
    elif current_user.role == UserRole.STUDENT:
        # Student can only view their own assignment
        if current_user.id != assignment.student_id:
            raise HTTPException(
                status_code=403, detail="Students can only view their own assignments"
            )
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return assignment


# Fields a student may modify on their own assignment; everything else
# (due dates, assigned date, instructions, max points) is admin-only.
STUDENT_EDITABLE_ASSIGNMENT_FIELDS = {
    "status",
    "student_notes",
    "submission_notes",
    "submission_artifacts",
}


@router.put(
    "/student-assignments/{assignment_id}", response_model=StudentAssignmentResponse
)
def update_student_assignment(
    assignment_id: int,
    assignment_update: StudentAssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a student assignment."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    # Verify access
    if current_user.role == UserRole.ADMIN:
        # Admin can manage any student
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    elif current_user.role == UserRole.STUDENT:
        # Student can only update their own assignment
        if current_user.id != assignment.student_id:
            raise HTTPException(
                status_code=403, detail="Students can only update their own assignments"
            )
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = assignment_update.dict(exclude_unset=True)

    if current_user.role == UserRole.STUDENT:
        disallowed = set(update_data) - STUDENT_EDITABLE_ASSIGNMENT_FIELDS
        if disallowed:
            raise HTTPException(
                status_code=403,
                detail=f"You may not modify: {', '.join(sorted(disallowed))}",
            )

    # Handle submission_artifacts JSON serialization
    if (
        "submission_artifacts" in update_data
        and update_data["submission_artifacts"] is not None
    ):
        update_data["submission_artifacts"] = json.dumps(
            update_data["submission_artifacts"]
        )

    # Handle status change workflow
    if "status" in update_data:
        new_status = update_data["status"]
        today = date.today()

        # Set appropriate dates based on status transition
        if new_status == AssignmentStatus.IN_PROGRESS and not assignment.started_date:
            assignment.started_date = today
        elif new_status == AssignmentStatus.SUBMITTED and not assignment.submitted_date:
            assignment.submitted_date = today
            # Also ensure it was started
            if not assignment.started_date:
                assignment.started_date = today

    # Apply all updates
    for field, value in update_data.items():
        setattr(assignment, field, value)

    # Auto-update status based on changes (this will handle other cases)
    assignment.update_status()

    db.commit()
    db.refresh(assignment)

    return assignment


# Additional workflow endpoints


@router.get("/my-assignments", response_model=List[StudentAssignmentResponse])
def get_my_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    status: Optional[str] = Query(None),
    subject_id: Optional[int] = Query(None),
):
    """Get assignments for the current user (student only)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403, detail="This endpoint is for students only"
        )

    query = (
        db.query(StudentAssignment)
        .options(
            joinedload(StudentAssignment.template).joinedload(
                AssignmentTemplate.subject
            )
        )
        .filter(StudentAssignment.student_id == current_user.id)
    )

    if subject_id:
        query = query.join(AssignmentTemplate).filter(
            AssignmentTemplate.subject_id == subject_id
        )

    if status:
        query = query.filter(StudentAssignment.status == status)

    assignments = query.order_by(StudentAssignment.due_date.asc().nullslast()).all()
    return assignments


@router.post(
    "/student-assignments/{assignment_id}/start",
    response_model=StudentAssignmentResponse,
)
def start_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Mark an assignment as started by a student."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Verify student access
    if (
        current_user.role == UserRole.STUDENT
        and current_user.id != assignment.student_id
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.ADMIN:
        # Admin can manage any student
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

    if assignment.started_date is None:
        assignment.started_date = date.today()
        assignment.update_status()
        db.commit()
        db.refresh(assignment)

    return assignment


@router.post(
    "/student-assignments/{assignment_id}/complete",
    response_model=StudentAssignmentResponse,
)
def complete_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    submission_notes: Optional[str] = None,
    submission_artifacts: Optional[List[str]] = None,
):
    """Mark an assignment as completed by a student."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Verify student access
    if (
        current_user.role == UserRole.STUDENT
        and current_user.id != assignment.student_id
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.ADMIN:
        # Admin can manage any student
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

    assignment.completed_date = date.today()
    assignment.submitted_date = date.today()
    if submission_notes:
        assignment.submission_notes = submission_notes
    if submission_artifacts:
        assignment.submission_artifacts = json.dumps(submission_artifacts)

    # Auto-start if not started
    if assignment.started_date is None:
        assignment.started_date = date.today()

    assignment.update_status()
    db.commit()
    db.refresh(assignment)

    return assignment


@router.delete("/student-assignments/{assignment_id}")
def delete_student_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a student assignment (unassign from student)."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    # Verify access - admin must manage the student
    if current_user.role == UserRole.ADMIN:
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(
            status_code=403, detail="Only administrators can delete student assignments"
        )

    db.delete(assignment)
    db.commit()

    logger.info(f"Deleted student assignment {assignment_id} by user {current_user.id}")
    return {"message": "Student assignment deleted successfully"}


@router.post(
    "/student-assignments/{assignment_id}/archive",
    response_model=StudentAssignmentResponse,
)
def archive_student_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Archive a student assignment."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    # Verify access - admin must manage the student
    if current_user.role == UserRole.ADMIN:
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can archive student assignments",
        )

    # Set status to archived (we need to add this to the enum if it doesn't exist)
    assignment.status = (
        AssignmentStatus.EXCUSED
    )  # Using EXCUSED as archived status for now
    db.commit()
    db.refresh(assignment)

    logger.info(
        f"Archived student assignment {assignment_id} by user {current_user.id}"
    )
    return assignment
