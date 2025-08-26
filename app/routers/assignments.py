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

"""APIs for assignments."""

import json
import logging
from datetime import date, datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.assignment import AssignmentStatus, AssignmentTemplate, StudentAssignment
from app.models.lesson import Lesson, Subject
from app.models.term import Term
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.crud import points as points_crud
from app.schemas.assignment import (
    AssignmentAssignmentRequest,
    AssignmentAssignmentResponse,
    AssignmentTemplateCreate,
    AssignmentTemplateResponse,
    AssignmentTemplateUpdate,
    StudentAssignmentGrade,
    StudentAssignmentResponse,
    StudentAssignmentUpdate,
    StudentProgressSummary,
    SubjectProgressResponse,
    AssignmentTemplateExport,
    AssignmentTemplateImport,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Assignment Template Management


@router.post("/templates", response_model=AssignmentTemplateResponse)
def create_assignment_template(
    template: AssignmentTemplateCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new assignment template."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can create assignment templates",
        )

    # Verify subject exists
    subject = db.query(Subject).filter(Subject.id == template.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Verify lesson exists if provided
    if template.lesson_id:
        lesson = db.query(Lesson).filter(Lesson.id == template.lesson_id).first()
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")

    db_template = AssignmentTemplate(**template.dict(), created_by=current_user.id)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    logger.info(
        f"Created assignment template {db_template.id} by user {current_user.id}"
    )
    return db_template


@router.get("/templates", response_model=List[AssignmentTemplateResponse])
def get_assignment_templates(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    lesson_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get assignment templates with optional filtering."""
    query = db.query(AssignmentTemplate).options(
        joinedload(AssignmentTemplate.subject),
        joinedload(AssignmentTemplate.lesson),
        joinedload(AssignmentTemplate.creator)
    )
    
    # Apply access control
    if current_user.role != UserRole.ADMIN:
        query = query.filter(AssignmentTemplate.created_by == current_user.id)

    # Filter out archived templates unless explicitly requested
    if not include_archived:
        query = query.filter(AssignmentTemplate.is_archived.is_(False))

    # Apply optional filters
    if lesson_id:
        query = query.filter(AssignmentTemplate.lesson_id == lesson_id)
    if subject_id:
        query = query.filter(AssignmentTemplate.subject_id == subject_id)

    templates = query.offset(skip).limit(limit).all()

    # Populate computed fields for each template
    from sqlalchemy import func

    for template in templates:
        # Count current assignments for this template (exclude submitted/graded)
        template.total_assigned = (
            db.query(StudentAssignment)
            .filter(
                StudentAssignment.template_id == template.id,
                StudentAssignment.status.notin_([AssignmentStatus.SUBMITTED, AssignmentStatus.GRADED])
            )
            .count()
        )

        # Calculate average grade
        avg_result = (
            db.query(func.avg(StudentAssignment.percentage_grade))
            .filter(
                StudentAssignment.template_id == template.id,
                StudentAssignment.is_graded,
            )
            .scalar()
        )
        template.average_grade = float(avg_result) if avg_result else None

    return templates


@router.get("/templates/{template_id}", response_model=AssignmentTemplateResponse)
def get_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific assignment template."""
    query = db.query(AssignmentTemplate).options(
        joinedload(AssignmentTemplate.subject),
        joinedload(AssignmentTemplate.lesson),
        joinedload(AssignmentTemplate.creator)
    ).filter(AssignmentTemplate.id == template_id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(AssignmentTemplate.created_by == current_user.id)
    template = query.first()

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    return template


@router.put("/templates/{template_id}", response_model=AssignmentTemplateResponse)
def update_assignment_template(
    template_id: int,
    template_update: AssignmentTemplateUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update an assignment template."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can update assignment templates",
        )

    # Since only admins can update, they can update any template
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Verify new subject exists if provided
    if template_update.subject_id:
        subject = (
            db.query(Subject).filter(Subject.id == template_update.subject_id).first()
        )
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")

    # Verify new lesson exists if provided
    if template_update.lesson_id:
        lesson = db.query(Lesson).filter(Lesson.id == template_update.lesson_id).first()
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")

    update_data = template_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)

    logger.info(f"Updated assignment template {template_id} by user {current_user.id}")
    return template


@router.delete("/templates/{template_id}")
def delete_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete an assignment template."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can delete assignment templates",
        )

    # Since only admins can delete, they can delete any template
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Check if template has assigned students
    student_count = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.template_id == template_id)
        .count()
    )

    if student_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot delete template with {student_count} "
                "student assignments. Unassign students first."
            ),
        )

    db.delete(template)
    db.commit()

    logger.info(f"Deleted assignment template {template_id} by user {current_user.id}")
    return {"message": "Assignment template deleted successfully"}


@router.post(
    "/templates/{template_id}/archive", response_model=AssignmentTemplateResponse
)
def archive_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Archive an assignment template."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can archive templates"
        )

    # Since only admins can archive, they can archive any template
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    template.is_archived = not template.is_archived
    db.commit()
    db.refresh(template)

    logger.info(
        f"Toggled archive status for template {template_id} to {template.is_archived}"
    )
    return template


# Assignment Assignment (Assigning templates to students)


@router.post("/assign", response_model=AssignmentAssignmentResponse)
def assign_template_to_students(
    assignment_request: AssignmentAssignmentRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Assign an assignment template to multiple students."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can assign assignments"
        )

    # Find active term
    active_term = db.query(Term).filter(Term.is_active).first()
    if not active_term:
        raise HTTPException(
            status_code=400,
            detail="No active term found. "
            "Please set an active term before assigning assignments.",
        )

    # Verify template exists and is accessible by current user
    query = db.query(AssignmentTemplate).filter(
        AssignmentTemplate.id == assignment_request.template_id
    )
    if current_user.role != UserRole.ADMIN:
        query = query.filter(AssignmentTemplate.created_by == current_user.id)
    template = query.first()

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

    # Use current date for assignment date
    assigned_date = date.today()

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
                assigned_by=current_user.id,
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
            raise HTTPException(
                status_code=404, detail="Student not found"
            )
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
        query = query.filter(StudentAssignment.status != AssignmentStatus.ARCHIVED)

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

    update_data = assignment_update.dict(exclude_unset=True)
    
    # Handle submission_artifacts JSON serialization
    if "submission_artifacts" in update_data and update_data["submission_artifacts"] is not None:
        update_data["submission_artifacts"] = json.dumps(update_data["submission_artifacts"])

    # Handle status change workflow
    if "status" in update_data:
        from datetime import date

        from app.models.assignment import AssignmentStatus

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


@router.post(
    "/student-assignments/{assignment_id}/grade",
    response_model=StudentAssignmentResponse,
)
def grade_student_assignment(
    assignment_id: int,
    grade_data: StudentAssignmentGrade,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Grade a student assignment."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can grade assignments"
        )

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
    assignment.graded_by = current_user.id

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
                "Awarded %s points to student %s for assignment %s",
                grade_data.points_earned,
                assignment.student_id,
                assignment.id,
            )
    except Exception as e:
        # Don't fail the grading process if points awarding fails
        logger.error(
            "Failed to award points for assignment %s: %s",
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


# Progress and Analytics


@router.get("/students/{student_id}/progress", response_model=StudentProgressSummary)
def get_student_progress(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get comprehensive progress summary for a student."""
    # Verify access
    if current_user.role == UserRole.ADMIN:
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(
                status_code=404, detail="Student not found"
            )
    elif current_user.role == UserRole.STUDENT and current_user.id != student_id:
        raise HTTPException(
            status_code=403, detail="Students can only view their own progress"
        )
    else:
        student = current_user

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


@router.get("/dashboard/overview")
def get_assignment_dashboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get assignment dashboard overview for admin or student."""
    from app.models.assignment import AssignmentStatus

    if current_user.role == UserRole.ADMIN:
        # Admin dashboard - overview of all managed students
        students = (
            db.query(User)
            .filter(User.role == UserRole.STUDENT)
            .all()
        )

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
                not StudentAssignment.is_graded,
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


@router.get("/submitted", response_model=List[StudentAssignmentResponse])
def get_submitted_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    status: Optional[str] = Query(None),
    subject_id: Optional[int] = Query(None),
):
    """Get submitted assignments for grading (Admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can view submitted assignments"
        )

    # Import enum for proper type handling
    from app.models.assignment import AssignmentStatus

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
    current_user: Annotated[User, Depends(get_current_active_user)],
    status: Optional[str] = Query(None),
    subject_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
):
    """Get all assignments for admin grading view - allows managing all assignment statuses."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can view all assignments"
        )

    # Import enum for proper type handling
    from app.models.assignment import AssignmentStatus

    # Start with assignments for all students
    query = (
        db.query(StudentAssignment)
        .join(User, StudentAssignment.student_id == User.id)
        .filter(User.role == UserRole.STUDENT)
        .options(
            joinedload(StudentAssignment.template).joinedload(AssignmentTemplate.subject),
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
        StudentAssignment.assigned_date.desc(),
        StudentAssignment.due_date.asc()
    ).all()

    return assignments


@router.get("/student-term-grades/{student_id}")
def get_student_term_grades(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get term grades for a specific student."""
    from sqlalchemy import func

    from app.models.lesson import Subject
    from app.models.term import Term, TermSubject

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

    # Get all terms with grades for this student
    term_grades = (
        db.query(
            Term.id.label("term_id"),
            Term.name.label("term_name"),
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            func.sum(StudentAssignment.points_earned).label("earned_points"),
            func.sum(
                func.coalesce(
                    StudentAssignment.custom_max_points, AssignmentTemplate.max_points
                )
            ).label("total_points"),
            func.count(StudentAssignment.id).label("assignments_count"),
            func.count(func.case([(StudentAssignment.is_graded, 1)])).label(
                "completed_count"
            ),
        )
        .select_from(StudentAssignment)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .join(Subject, AssignmentTemplate.subject_id == Subject.id)
        .join(TermSubject, TermSubject.subject_id == Subject.id)
        .join(Term, TermSubject.term_id == Term.id)
        .filter(
            StudentAssignment.student_id == student_id,
            StudentAssignment.is_graded,
        )
        .group_by(Term.id, Term.name, Subject.id, Subject.name)
        .order_by(Term.term_order, Subject.name)
        .all()
    )

    # Calculate percentages and letter grades
    result = []
    for grade in term_grades:
        if grade.total_points > 0:
            percentage = round((grade.earned_points / grade.total_points) * 100, 1)

            # Calculate letter grade
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

            result.append(
                {
                    "term_id": grade.term_id,
                    "term_name": grade.term_name,
                    "subject_id": grade.subject_id,
                    "subject_name": grade.subject_name,
                    "total_points": grade.total_points,
                    "earned_points": grade.earned_points,
                    "percentage": percentage,
                    "letter_grade": letter_grade,
                    "assignments_count": grade.assignments_count,
                    "completed_count": grade.completed_count,
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
    from app.models.assignment import AssignmentStatus

    assignment.status = (
        AssignmentStatus.EXCUSED
    )  # Using EXCUSED as archived status for now
    db.commit()
    db.refresh(assignment)

    logger.info(
        f"Archived student assignment {assignment_id} by user {current_user.id}"
    )
    return assignment


@router.get(
    "/templates/{template_id}/assignments",
    response_model=List[StudentAssignmentResponse],
)
def get_template_assignments(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all student assignments for a specific template."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can view template assignments"
        )

    # Verify template exists and is accessible by current user
    query = db.query(AssignmentTemplate).filter(AssignmentTemplate.id == template_id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(AssignmentTemplate.created_by == current_user.id)
    template = query.first()

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Get all student assignments for this template
    assignments = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.student))
        .filter(StudentAssignment.template_id == template_id)
        .join(User, StudentAssignment.student_id == User.id)
        .filter(
            User.role == UserRole.STUDENT  # All students accessible by admin
        )
        .all()
    )

    return assignments


# Export/Import functionality for assignment templates


@router.get("/templates/{template_id}/export", response_model=AssignmentTemplateExport)
def export_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Export an assignment template for sharing with other homeschool families."""
    # Get template with subject
    template = db.query(AssignmentTemplate).filter(AssignmentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")
    
    # Check if template is exportable
    if not template.is_exportable:
        raise HTTPException(status_code=403, detail="This assignment template is not marked as exportable")
    
    # Build export data
    export_data = AssignmentTemplateExport(
        name=template.name,
        description=template.description,
        instructions=template.instructions,
        assignment_type=template.assignment_type.value,
        subject_name=template.subject.name,
        max_points=template.max_points,
        estimated_duration_minutes=template.estimated_duration_minutes,
        prerequisites=template.prerequisites,
        materials_needed=template.materials_needed,
        export_metadata={
            "template_id": template_id,
            "exported_by": f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
            "export_timestamp": str(datetime.utcnow()),
            "format_version": "1.0",
        }
    )
    
    return export_data


@router.post("/templates/import")
def import_assignment_template(
    import_request: AssignmentTemplateImport,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Import an assignment template from another homeschool family."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can import assignment templates"
        )
    
    from datetime import datetime
    from app.enums import AssignmentType
    
    try:
        assignment_data = import_request.assignment_data
        
        # Handle subject mapping
        subject_id = import_request.target_subject_id
        if not subject_id:
            # Try to find existing subject by name
            existing_subject = db.query(Subject).filter(Subject.name == assignment_data.subject_name).first()
            if existing_subject:
                subject_id = existing_subject.id
            else:
                # Create new subject
                new_subject = Subject(
                    name=assignment_data.subject_name,
                    description=f"Auto-created during assignment import",
                    color="#3B82F6"  # Default color
                )
                db.add(new_subject)
                db.flush()
                subject_id = new_subject.id
        
        # Create assignment template
        template_dict = {
            "name": assignment_data.name,
            "description": assignment_data.description,
            "instructions": assignment_data.instructions,
            "assignment_type": AssignmentType(assignment_data.assignment_type),
            "lesson_id": import_request.target_lesson_id,
            "subject_id": subject_id,
            "max_points": assignment_data.max_points,
            "estimated_duration_minutes": assignment_data.estimated_duration_minutes,
            "prerequisites": assignment_data.prerequisites,
            "materials_needed": assignment_data.materials_needed,
            "is_exportable": True,
            "created_by": current_user.id,
        }
        
        new_template = AssignmentTemplate(**template_dict)
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        
        return {
            "success": True,
            "template_id": new_template.id,
            "message": f"Successfully imported assignment template '{new_template.name}'"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Import failed: {str(e)}"
        )


@router.post("/templates/bulk-export")
def bulk_export_assignment_templates(
    template_ids: List[int],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Export multiple assignment templates as a single package."""
    from datetime import datetime
    
    if not template_ids:
        raise HTTPException(status_code=400, detail="No template IDs provided")
    
    # Get templates
    templates = (
        db.query(AssignmentTemplate)
        .options(
            joinedload(AssignmentTemplate.subject),
            joinedload(AssignmentTemplate.lesson),
            joinedload(AssignmentTemplate.creator)
        )
        .filter(AssignmentTemplate.id.in_(template_ids))
        .all()
    )
    
    found_ids = {template.id for template in templates}
    missing_ids = set(template_ids) - found_ids
    
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Templates with IDs {list(missing_ids)} not found"
        )
    
    # Check exportability
    non_exportable = [t for t in templates if not t.is_exportable]
    if non_exportable:
        non_exportable_names = [t.name for t in non_exportable]
        raise HTTPException(
            status_code=403,
            detail=f"The following templates are not exportable: {', '.join(non_exportable_names)}"
        )
    
    # Build export package
    exported_templates = []
    for template in templates:
        export_data = AssignmentTemplateExport(
            name=template.name,
            description=template.description,
            instructions=template.instructions,
            assignment_type=template.assignment_type.value,
            subject_name=template.subject.name,
            max_points=template.max_points,
            estimated_duration_minutes=template.estimated_duration_minutes,
            prerequisites=template.prerequisites,
            materials_needed=template.materials_needed,
            export_metadata={
                "template_id": template.id,
            }
        )
        exported_templates.append(export_data)
    
    export_package = {
        "format_version": "1.0",
        "export_timestamp": datetime.utcnow(),
        "exported_by": f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
        "templates": exported_templates,
        "metadata": {
            "template_count": len(exported_templates),
            "subjects": list(set(t.subject.name for t in templates)),
        }
    }
    
    return export_package