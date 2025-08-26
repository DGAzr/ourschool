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

"""APIs for lessons."""
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.lesson import Lesson, LessonAssignment, Subject
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.lesson import (
    AssignLessonRequest,
    AssignLessonResponse,
    LessonAssignmentCreate,
    LessonAssignmentResponse,
    LessonAssignmentUpdate,
    LessonCreate,
    LessonUpdate,
    LessonWithAssignments,
    SubjectCreate,
    SubjectUpdate,
    LessonExport,
    LessonExportData,
    AssignmentTemplateExportData,
    LessonImportRequest,
    LessonImportResponse,
)
from app.schemas.lesson import (
    Lesson as LessonSchema,
)
from app.schemas.lesson import (
    Subject as SubjectSchema,
)

router = APIRouter()


@router.post("/subjects/", response_model=SubjectSchema)
def create_subject(
    subject: SubjectCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new subject."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can create subjects"
        )

    db_subject = Subject(**subject.dict())
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.get("/subjects/", response_model=List[SubjectSchema])
def read_subjects(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all subjects."""
    return db.query(Subject).all()


@router.put("/subjects/{subject_id}", response_model=SubjectSchema)
def update_subject(
    subject_id: int,
    subject_update: SubjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a subject."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can update subjects"
        )

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    update_data = subject_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a subject."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can delete subjects"
        )

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Check if there are assignment templates using this subject
    templates_count = db.query(AssignmentTemplate).filter(AssignmentTemplate.subject_id == subject_id).count()
    if templates_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete subject. It is used by {templates_count} assignment template(s).",
        )

    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully"}


@router.post("/", response_model=LessonSchema)
def create_lesson(
    lesson: LessonCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new lesson."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can create lessons"
        )

    # No need to validate subject_id since lessons no longer have direct subject relationship

    db_lesson = Lesson(**lesson.dict())
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return db_lesson


@router.get("/", response_model=List[LessonSchema])
def read_lessons(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    subject_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
):
    """Get all lessons."""
    query = db.query(Lesson)

    if start_date:
        query = query.filter(Lesson.scheduled_date >= start_date)
    if end_date:
        query = query.filter(Lesson.scheduled_date <= end_date)
    if subject_id:
        # Filter lessons by subject through their assignments
        query = query.join(LessonAssignment).join(AssignmentTemplate).filter(AssignmentTemplate.subject_id == subject_id)

    # Note: student_id filtering removed with lesson plan system

    return query.order_by(Lesson.lesson_order, Lesson.scheduled_date).all()


@router.get("/{lesson_id}", response_model=LessonSchema)
def read_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific lesson."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.put("/{lesson_id}", response_model=LessonSchema)
def update_lesson(
    lesson_id: int,
    lesson_update: LessonUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a lesson."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can update lessons"
        )

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    update_data = lesson_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)

    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a lesson."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can delete lessons"
        )

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    db.delete(lesson)
    db.commit()
    return {"message": "Lesson deleted successfully"}


# Lesson progress tracking removed with lesson plan system

# Lesson Assignment Management (grouping assignments within lessons)


@router.post("/{lesson_id}/assignments", response_model=LessonAssignmentResponse)
def add_assignment_to_lesson(
    lesson_id: int,
    assignment_data: LessonAssignmentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Add an assignment template to a lesson with specific ordering and timing."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can manage lesson assignments"
        )

    # Verify lesson exists
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Verify assignment template exists
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == assignment_data.assignment_template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Check if assignment is already in this lesson
    existing = (
        db.query(LessonAssignment)
        .filter(
            LessonAssignment.lesson_id == lesson_id,
            LessonAssignment.assignment_template_id
            == assignment_data.assignment_template_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Assignment is already part of this lesson"
        )

    # Create lesson assignment
    lesson_assignment = LessonAssignment(lesson_id=lesson_id, **assignment_data.dict())

    db.add(lesson_assignment)
    db.commit()
    db.refresh(lesson_assignment)

    # Populate assignment template details for response
    assignment_template_data = {
        "id": lesson_assignment.assignment_template.id,
        "name": lesson_assignment.assignment_template.name,
        "assignment_type": lesson_assignment.assignment_template.assignment_type,
        "max_points": lesson_assignment.assignment_template.max_points,
        "difficulty_level": lesson_assignment.assignment_template.difficulty_level,
        "estimated_duration_minutes": (
            lesson_assignment.assignment_template.estimated_duration_minutes
        ),
        "description": lesson_assignment.assignment_template.description,
    }

    # Create response dict
    return {
        "id": lesson_assignment.id,
        "lesson_id": lesson_assignment.lesson_id,
        "assignment_template_id": lesson_assignment.assignment_template_id,
        "order_in_lesson": lesson_assignment.order_in_lesson,
        "planned_duration_minutes": lesson_assignment.planned_duration_minutes,
        "custom_instructions": lesson_assignment.custom_instructions,
        "is_required": lesson_assignment.is_required,
        "custom_max_points": lesson_assignment.custom_max_points,
        "created_at": lesson_assignment.created_at,
        "assignment_template": assignment_template_data,
    }


@router.get("/{lesson_id}/assignments", response_model=List[LessonAssignmentResponse])
def get_lesson_assignments(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all assignments for a specific lesson."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    assignments = (
        db.query(LessonAssignment)
        .filter(LessonAssignment.lesson_id == lesson_id)
        .order_by(LessonAssignment.order_in_lesson)
        .all()
    )

    # Populate assignment template details
    for assignment in assignments:
        assignment.assignment_template = {
            "id": assignment.assignment_template.id,
            "name": assignment.assignment_template.name,
            "assignment_type": assignment.assignment_template.assignment_type,
            "max_points": assignment.assignment_template.max_points,
            "difficulty_level": assignment.assignment_template.difficulty_level,
            "estimated_duration_minutes": (
                assignment.assignment_template.estimated_duration_minutes
            ),
        }

    return assignments


@router.put(
    "/{lesson_id}/assignments/{assignment_id}", response_model=LessonAssignmentResponse
)
def update_lesson_assignment(
    lesson_id: int,
    assignment_id: int,
    assignment_update: LessonAssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a lesson assignment's ordering, timing, or other metadata."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can manage lesson assignments"
        )

    lesson_assignment = (
        db.query(LessonAssignment)
        .filter(
            LessonAssignment.id == assignment_id,
            LessonAssignment.lesson_id == lesson_id,
        )
        .first()
    )

    if not lesson_assignment:
        raise HTTPException(status_code=404, detail="Lesson assignment not found")

    update_data = assignment_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson_assignment, field, value)

    db.commit()
    db.refresh(lesson_assignment)

    # Populate assignment template details for response
    assignment_template_data = {
        "id": lesson_assignment.assignment_template.id,
        "name": lesson_assignment.assignment_template.name,
        "assignment_type": lesson_assignment.assignment_template.assignment_type,
        "max_points": lesson_assignment.assignment_template.max_points,
        "difficulty_level": lesson_assignment.assignment_template.difficulty_level,
        "estimated_duration_minutes": (
            lesson_assignment.assignment_template.estimated_duration_minutes
        ),
        "description": lesson_assignment.assignment_template.description,
    }

    # Create response dict
    return {
        "id": lesson_assignment.id,
        "lesson_id": lesson_assignment.lesson_id,
        "assignment_template_id": lesson_assignment.assignment_template_id,
        "order_in_lesson": lesson_assignment.order_in_lesson,
        "planned_duration_minutes": lesson_assignment.planned_duration_minutes,
        "custom_instructions": lesson_assignment.custom_instructions,
        "is_required": lesson_assignment.is_required,
        "custom_max_points": lesson_assignment.custom_max_points,
        "created_at": lesson_assignment.created_at,
        "assignment_template": assignment_template_data,
    }


@router.delete("/{lesson_id}/assignments/{assignment_id}")
def remove_assignment_from_lesson(
    lesson_id: int,
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Remove an assignment from a lesson."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can manage lesson assignments"
        )

    lesson_assignment = (
        db.query(LessonAssignment)
        .filter(
            LessonAssignment.id == assignment_id,
            LessonAssignment.lesson_id == lesson_id,
        )
        .first()
    )

    if not lesson_assignment:
        raise HTTPException(status_code=404, detail="Lesson assignment not found")

    db.delete(lesson_assignment)
    db.commit()

    return {"message": "Assignment removed from lesson successfully"}


@router.get("/{lesson_id}/with-assignments", response_model=LessonWithAssignments)
def get_lesson_with_assignments(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a lesson with all its assignments and computed metadata."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get lesson assignments with template details
    assignments = (
        db.query(LessonAssignment)
        .filter(LessonAssignment.lesson_id == lesson_id)
        .order_by(LessonAssignment.order_in_lesson)
        .all()
    )

    # Populate assignment template details and calculate totals
    total_planned_duration = 0
    assignment_responses = []

    for assignment in assignments:
        assignment_dict = {
            "id": assignment.id,
            "lesson_id": assignment.lesson_id,
            "assignment_template_id": assignment.assignment_template_id,
            "order_in_lesson": assignment.order_in_lesson,
            "planned_duration_minutes": assignment.planned_duration_minutes,
            "custom_instructions": assignment.custom_instructions,
            "is_required": assignment.is_required,
            "custom_max_points": assignment.custom_max_points,
            "created_at": assignment.created_at,
            "assignment_template": {
                "id": assignment.assignment_template.id,
                "name": assignment.assignment_template.name,
                "assignment_type": assignment.assignment_template.assignment_type,
                "max_points": assignment.assignment_template.max_points,
                "difficulty_level": assignment.assignment_template.difficulty_level,
                "estimated_duration_minutes": (
                    assignment.assignment_template.estimated_duration_minutes
                ),
                "description": assignment.assignment_template.description,
            },
        }
        assignment_responses.append(assignment_dict)

        if assignment.planned_duration_minutes:
            total_planned_duration += assignment.planned_duration_minutes

    # Create response
    lesson_dict = {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "subjects": lesson.subjects,
        "subject_names": lesson.subject_names,
        "subject_colors": lesson.subject_colors,
        "primary_subject": lesson.primary_subject,
        "scheduled_date": lesson.scheduled_date,
        "start_time": lesson.start_time,
        "end_time": lesson.end_time,
        "estimated_duration_minutes": lesson.estimated_duration_minutes,
        "difficulty_level": lesson.difficulty_level,
        "materials_needed": lesson.materials_needed,
        "objectives": lesson.objectives,
        "prerequisites": lesson.prerequisites,
        "resources": lesson.resources,
        "lesson_order": lesson.lesson_order,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
        "subjects": lesson.subjects,
        "subject_names": lesson.subject_names,
        "subject_colors": lesson.subject_colors,
        "primary_subject": lesson.primary_subject,
        "assignments": assignment_responses,
        "total_planned_duration": (
            total_planned_duration if total_planned_duration > 0 else None
        ),
        "assignment_count": len(assignments),
    }

    return lesson_dict


# Lesson Assignment Workflow (assign entire lessons to students)


@router.post("/assign", response_model=AssignLessonResponse)
def assign_lesson_to_students(
    assignment_request: AssignLessonRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Assign a lesson to students.

    This creates all lesson assignments for each student.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can assign lessons"
        )

    # Verify lesson exists
    lesson = db.query(Lesson).filter(Lesson.id == assignment_request.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get all assignments in this lesson
    lesson_assignments = (
        db.query(LessonAssignment)
        .filter(LessonAssignment.lesson_id == assignment_request.lesson_id)
        .all()
    )

    if not lesson_assignments:
        raise HTTPException(
            status_code=400, detail="Lesson has no assignments to assign"
        )

    # Verify all students exist and are active (admins can assign to any student)
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

    created_assignment_instances = []
    failed_assignments = []
    assignments_created_count = 0

    for student_id in assignment_request.student_ids:
        try:
            student_assignments_for_lesson = []

            # Create individual assignment instances for each assignment in the lesson
            for lesson_assignment in lesson_assignments:
                # Check if this specific assignment is already assigned to the student
                existing_assignment = (
                    db.query(StudentAssignment)
                    .filter(
                        StudentAssignment.template_id
                        == lesson_assignment.assignment_template_id,
                        StudentAssignment.student_id == student_id,
                    )
                    .first()
                )

                if not existing_assignment:
                    student_assignment = StudentAssignment(
                        template_id=lesson_assignment.assignment_template_id,
                        student_id=student_id,
                        due_date=assignment_request.due_date,
                        custom_instructions=lesson_assignment.custom_instructions
                        or assignment_request.custom_instructions,
                        custom_max_points=lesson_assignment.custom_max_points,
                        assigned_by=current_user.id,
                    )

                    db.add(student_assignment)
                    created_assignment_instances.append(student_assignment)
                    student_assignments_for_lesson.append(student_assignment)

            if student_assignments_for_lesson:
                assignments_created_count += 1

        except Exception as e:
            failed_assignments.append({"student_id": student_id, "error": str(e)})

    db.commit()

    # Refresh created objects
    for assignment in created_assignment_instances:
        db.refresh(assignment)

    return AssignLessonResponse(
        success_count=assignments_created_count,
        failed_assignments=failed_assignments,
        created_student_assignments=[],  # No longer using StudentLessonAssignment
        created_assignment_instances=[
            {"id": a.id, "student_id": a.student_id, "template_id": a.template_id}
            for a in created_assignment_instances
        ],
    )


# Export/Import functionality for sharing lessons between families


@router.get("/{lesson_id}/export", response_model=LessonExport)
def export_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Export a lesson for sharing with other homeschool families."""
    from datetime import datetime
    
    # Get lesson with all related data
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Get lesson assignments
    lesson_assignments = (
        db.query(LessonAssignment)
        .filter(LessonAssignment.lesson_id == lesson_id)
        .order_by(LessonAssignment.order_in_lesson)
        .all()
    )
    
    # Build assignment export data
    assignments_export = []
    for la in lesson_assignments:
        template = la.assignment_template
        assignment_data = AssignmentTemplateExportData(
            name=template.name,
            description=template.description,
            instructions=template.instructions,
            assignment_type=template.assignment_type.value,
            subject_name=template.subject.name,
            max_points=template.max_points,
            estimated_duration_minutes=template.estimated_duration_minutes,
            difficulty_level=template.difficulty_level.value,
            prerequisites=template.prerequisites,
            materials_needed=template.materials_needed,
            order_in_lesson=la.order_in_lesson,
            planned_duration_minutes=la.planned_duration_minutes,
            custom_instructions=la.custom_instructions,
            is_required=la.is_required,
            custom_max_points=la.custom_max_points,
        )
        assignments_export.append(assignment_data)
    
    # Build lesson export data
    lesson_data = LessonExportData(
        title=lesson.title,
        description=lesson.description,
        estimated_duration_minutes=lesson.estimated_duration_minutes,
        difficulty_level=lesson.difficulty_level.value if lesson.difficulty_level else "intermediate",
        materials_needed=lesson.materials_needed,
        objectives=lesson.objectives,
        prerequisites=lesson.prerequisites,
        resources=lesson.resources,
        lesson_order=lesson.lesson_order,
        assignments=assignments_export,
        subject_names=lesson.subject_names,
    )
    
    # Create export package
    export_package = LessonExport(
        format_version="1.0",
        export_timestamp=datetime.utcnow(),
        exported_by=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
        lesson_data=lesson_data,
        metadata={
            "lesson_id": lesson_id,
            "assignment_count": len(assignments_export),
            "subjects": lesson.subject_names,
        }
    )
    
    return export_package


@router.post("/import", response_model=LessonImportResponse)
def import_lesson(
    import_request: LessonImportRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Import a lesson from another homeschool family."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can import lessons"
        )
    
    from datetime import datetime
    from app.enums import AssignmentType, DifficultyLevel
    
    warnings = []
    errors = []
    created_subjects = []
    created_assignments = []
    
    try:
        lesson_export = import_request.lesson_export
        lesson_data = lesson_export.lesson_data
        
        # Handle subject mappings and creation
        subject_map = {}
        for subject_name in lesson_data.subject_names:
            # Check if subject exists
            existing_subject = db.query(Subject).filter(Subject.name == subject_name).first()
            
            if existing_subject:
                subject_map[subject_name] = existing_subject.id
            elif import_request.create_missing_subjects:
                # Create new subject
                new_subject = Subject(
                    name=subject_name,
                    description=f"Auto-created during lesson import",
                    color="#3B82F6"  # Default color
                )
                db.add(new_subject)
                db.flush()
                subject_map[subject_name] = new_subject.id
                created_subjects.append(new_subject.id)
                warnings.append(f"Created new subject: {subject_name}")
            else:
                errors.append(f"Subject '{subject_name}' not found and create_missing_subjects is False")
        
        if errors:
            return LessonImportResponse(
                success=False,
                errors=errors,
                warnings=warnings
            )
        
        # Create the lesson
        lesson_dict = {
            "title": lesson_data.title,
            "description": lesson_data.description,
            "scheduled_date": import_request.target_date or datetime.utcnow().date(),
            "estimated_duration_minutes": lesson_data.estimated_duration_minutes,
            "difficulty_level": DifficultyLevel(lesson_data.difficulty_level),
            "materials_needed": lesson_data.materials_needed,
            "objectives": lesson_data.objectives,
            "prerequisites": lesson_data.prerequisites,
            "resources": lesson_data.resources,
            "lesson_order": lesson_data.lesson_order,
        }
        
        new_lesson = Lesson(**lesson_dict)
        db.add(new_lesson)
        db.flush()
        
        # Create assignment templates and lesson assignments
        for assignment_data in lesson_data.assignments:
            # Create assignment template
            template_dict = {
                "name": assignment_data.name,
                "description": assignment_data.description,
                "instructions": assignment_data.instructions,
                "assignment_type": AssignmentType(assignment_data.assignment_type),
                "subject_id": subject_map[assignment_data.subject_name],
                "max_points": assignment_data.max_points,
                "estimated_duration_minutes": assignment_data.estimated_duration_minutes,
                "difficulty_level": DifficultyLevel(assignment_data.difficulty_level),
                "prerequisites": assignment_data.prerequisites,
                "materials_needed": assignment_data.materials_needed,
                "is_exportable": True,
                "order_in_lesson": assignment_data.order_in_lesson,
                "created_by": current_user.id,
            }
            
            new_template = AssignmentTemplate(**template_dict)
            db.add(new_template)
            db.flush()
            created_assignments.append(new_template.id)
            
            # Create lesson assignment relationship
            lesson_assignment = LessonAssignment(
                lesson_id=new_lesson.id,
                assignment_template_id=new_template.id,
                order_in_lesson=assignment_data.order_in_lesson,
                planned_duration_minutes=assignment_data.planned_duration_minutes,
                custom_instructions=assignment_data.custom_instructions,
                is_required=assignment_data.is_required,
                custom_max_points=assignment_data.custom_max_points,
            )
            db.add(lesson_assignment)
        
        db.commit()
        db.refresh(new_lesson)
        
        return LessonImportResponse(
            success=True,
            lesson_id=new_lesson.id,
            created_lesson=new_lesson,
            created_assignments=created_assignments,
            created_subjects=created_subjects,
            warnings=warnings,
            errors=errors,
        )
        
    except Exception as e:
        db.rollback()
        errors.append(f"Import failed: {str(e)}")
        return LessonImportResponse(
            success=False,
            errors=errors,
            warnings=warnings,
        )