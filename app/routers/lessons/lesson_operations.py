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

"""APIs for lesson operations (assign, export, import)."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.enums import AssignmentType
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.lesson import Lesson, LessonAssignment, Subject
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.lesson import (
    AssignLessonRequest,
    AssignLessonResponse,
    AssignmentTemplateExportData,
    LessonExport,
    LessonExportData,
    LessonImportRequest,
    LessonImportResponse,
)

from .shared import get_lesson_or_404, require_admin

router = APIRouter()


@router.post("/assign", response_model=AssignLessonResponse)
def assign_lesson_to_students(
    assignment_request: AssignLessonRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
):
    """Assign a lesson to students.

    This creates all lesson assignments for each student.
    """
    # Verify lesson exists
    lesson = get_lesson_or_404(db, assignment_request.lesson_id)

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
                        StudentAssignment.template_id == lesson_assignment.assignment_template_id,
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


@router.get("/{lesson_id}/export", response_model=LessonExport)
def export_lesson(
    lesson_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Export a lesson for sharing with other homeschool families."""
    # Get lesson with all related data
    lesson = get_lesson_or_404(db, lesson_id)

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
    current_user: Annotated[User, Depends(require_admin)],
):
    """Import a lesson from another homeschool family."""
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