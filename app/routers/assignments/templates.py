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

"""Assignment template endpoints: CRUD, archive, and export/import."""

import logging
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.assignment import (
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.core.dual_auth import (
    AuthUser,
    get_actor_name_from_auth,
    get_user_id_from_auth,
    is_admin_user,
    require_admin_or_permission,
    require_user_or_permission,
)
from app.crud import assignment_types as crud_types
from app.schemas.assignment import (
    AssignmentTemplateCreate,
    AssignmentTemplateExport,
    AssignmentTemplateImport,
    AssignmentTemplateResponse,
    AssignmentTemplateUpdate,
    StudentAssignmentResponse,
)
from app.schemas.assignment_type import AssignmentTypeCreate

logger = logging.getLogger(__name__)
router = APIRouter()


def _validate_assignment_type(db: Session, key: str) -> None:
    """Reject template writes that reference an unknown/inactive type key."""
    type_row = crud_types.get_by_key(db, key)
    if type_row is None or not type_row.is_active:
        raise HTTPException(status_code=400, detail=f"Unknown assignment type '{key}'")


def _attach_template_stats(db: Session, templates: List[AssignmentTemplate]) -> None:
    """Populate the computed total_assigned / average_grade response fields.

    ``total_assigned`` counts every student assignment ever created from the
    template (including submitted/graded ones), matching the delete guard's
    "has student assignments" meaning — a fully-graded template is not "0".
    """
    for template in templates:
        template.total_assigned = (
            db.query(StudentAssignment)
            .filter(StudentAssignment.template_id == template.id)
            .count()
        )

        avg_result = (
            db.query(func.avg(StudentAssignment.percentage_grade))
            .filter(
                StudentAssignment.template_id == template.id,
                StudentAssignment.is_graded,
            )
            .scalar()
        )
        template.average_grade = float(avg_result) if avg_result else None


# Assignment Template Management


@router.post("/templates", response_model=AssignmentTemplateResponse)
def create_assignment_template(
    template: AssignmentTemplateCreate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Create a new assignment template (admin session or API key with assignments:write)."""
    # Verify subject exists
    subject = db.query(Subject).filter(Subject.id == template.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    _validate_assignment_type(db, template.assignment_type)

    created_by = get_user_id_from_auth(auth_user)
    db_template = AssignmentTemplate(**template.dict(), created_by=created_by)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    logger.info(
        "Created assignment template %s by %s",
        db_template.id,
        created_by if created_by is not None else "API key",
    )
    return db_template


@router.get("/templates", response_model=List[AssignmentTemplateResponse])
def get_assignment_templates(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_user_or_permission("assignments:read"))
    ],
    subject_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get assignment templates with optional filtering.

    Admin sessions and API keys (assignments:read) see all templates; student
    sessions are scoped to their own.
    """
    query = db.query(AssignmentTemplate).options(
        joinedload(AssignmentTemplate.subject), joinedload(AssignmentTemplate.creator)
    )

    # Access control: admins and API keys (attributed or not) see all;
    # student sessions see only their own.
    if isinstance(auth_user, User) and not is_admin_user(auth_user):
        query = query.filter(AssignmentTemplate.created_by == auth_user.id)

    # Filter out archived templates unless explicitly requested
    if not include_archived:
        query = query.filter(AssignmentTemplate.is_archived.is_(False))

    # Apply optional filters
    if subject_id:
        query = query.filter(AssignmentTemplate.subject_id == subject_id)
    if search:
        query = query.filter(
            AssignmentTemplate.name.ilike(f"%{search}%")
            | AssignmentTemplate.description.ilike(f"%{search}%")
        )

    templates = query.offset(skip).limit(limit).all()

    _attach_template_stats(db, templates)

    return templates


@router.get("/templates/{template_id}", response_model=AssignmentTemplateResponse)
def get_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:read"))
    ],
):
    """Get a specific assignment template."""
    template = (
        db.query(AssignmentTemplate)
        .options(
            joinedload(AssignmentTemplate.subject),
            joinedload(AssignmentTemplate.creator),
        )
        .filter(AssignmentTemplate.id == template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    _attach_template_stats(db, [template])

    return template


@router.put("/templates/{template_id}", response_model=AssignmentTemplateResponse)
def update_assignment_template(
    template_id: int,
    template_update: AssignmentTemplateUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Update an assignment template (admin session or API key with assignments:write)."""
    # Admins and authorized API keys can update any template
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

    update_data = template_update.dict(exclude_unset=True)
    if update_data.get("assignment_type") is not None:
        _validate_assignment_type(db, update_data["assignment_type"])
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)

    logger.info("Updated assignment template %s", template_id)
    return template


@router.delete("/templates/{template_id}")
def delete_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Delete an assignment template."""
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

    logger.info("Deleted assignment template %s", template_id)
    return {"message": "Assignment template deleted successfully"}


@router.post(
    "/templates/{template_id}/archive", response_model=AssignmentTemplateResponse
)
def archive_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Archive an assignment template."""
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


@router.get(
    "/templates/{template_id}/assignments",
    response_model=List[StudentAssignmentResponse],
)
def get_template_assignments(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:read"))
    ],
):
    """Get all student assignments for a specific template."""
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Get all student assignments for this template
    assignments = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.student))
        .filter(StudentAssignment.template_id == template_id)
        .join(User, StudentAssignment.student_id == User.id)
        .filter(User.role == UserRole.STUDENT)  # All students accessible by admin
        .all()
    )

    return assignments


# Export/Import functionality for assignment templates


@router.get("/templates/{template_id}/export", response_model=AssignmentTemplateExport)
def export_assignment_template(
    template_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:read"))
    ],
):
    """Export an assignment template for sharing with other homeschool families."""
    # Get template with subject
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    # Check if template is exportable
    if not template.is_exportable:
        raise HTTPException(
            status_code=403,
            detail="This assignment template is not marked as exportable",
        )

    # Build export data
    export_data = AssignmentTemplateExport(
        name=template.name,
        description=template.description,
        instructions=template.instructions,
        assignment_type=template.assignment_type,
        subject_name=template.subject.name,
        max_points=template.max_points,
        estimated_duration_minutes=template.estimated_duration_minutes,
        prerequisites=template.prerequisites,
        materials_needed=template.materials_needed,
        export_metadata={
            "template_id": template_id,
            "exported_by": get_actor_name_from_auth(auth_user),
            "export_timestamp": str(datetime.now(timezone.utc)),
            "format_version": "1.0",
        },
    )

    return export_data


@router.post("/templates/import")
def import_assignment_template(
    import_request: AssignmentTemplateImport,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Import an assignment template from another homeschool family."""
    try:
        assignment_data = import_request.assignment_data

        # Resolve the imported assignment type to a local type, creating it on
        # the fly when the source family used a type we don't have yet.
        imported_type_key = assignment_data.assignment_type or "homework"
        if crud_types.get_by_key(db, imported_type_key) is None:
            created_type = crud_types.create_assignment_type(
                db,
                AssignmentTypeCreate(
                    key=imported_type_key,
                    name=imported_type_key.replace("_", " ").title(),
                ),
            )
            imported_type_key = created_type.key

        # Handle subject mapping
        subject_id = import_request.target_subject_id
        if not subject_id:
            # Try to find existing subject by name
            existing_subject = (
                db.query(Subject)
                .filter(Subject.name == assignment_data.subject_name)
                .first()
            )
            if existing_subject:
                subject_id = existing_subject.id
            else:
                # Create new subject
                new_subject = Subject(
                    name=assignment_data.subject_name,
                    description="Auto-created during assignment import",
                    color="#3B82F6",  # Default color
                )
                db.add(new_subject)
                db.flush()
                subject_id = new_subject.id

        # Create assignment template
        template_dict = {
            "name": assignment_data.name,
            "description": assignment_data.description,
            "instructions": assignment_data.instructions,
            "assignment_type": imported_type_key,
            "subject_id": subject_id,
            "max_points": assignment_data.max_points,
            "estimated_duration_minutes": assignment_data.estimated_duration_minutes,
            "prerequisites": assignment_data.prerequisites,
            "materials_needed": assignment_data.materials_needed,
            "is_exportable": True,
            "created_by": get_user_id_from_auth(auth_user),
        }

        new_template = AssignmentTemplate(**template_dict)
        db.add(new_template)
        db.commit()
        db.refresh(new_template)

        return {
            "success": True,
            "template_id": new_template.id,
            "message": f"Successfully imported assignment template '{new_template.name}'",
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/templates/bulk-export")
def bulk_export_assignment_templates(
    template_ids: List[int],
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:read"))
    ],
):
    """Export multiple assignment templates as a single package."""

    if not template_ids:
        raise HTTPException(status_code=400, detail="No template IDs provided")

    # Get templates
    templates = (
        db.query(AssignmentTemplate)
        .options(
            joinedload(AssignmentTemplate.subject),
            joinedload(AssignmentTemplate.creator),
        )
        .filter(AssignmentTemplate.id.in_(template_ids))
        .all()
    )

    found_ids = {template.id for template in templates}
    missing_ids = set(template_ids) - found_ids

    if missing_ids:
        raise HTTPException(
            status_code=404, detail=f"Templates with IDs {list(missing_ids)} not found"
        )

    # Check exportability
    non_exportable = [t for t in templates if not t.is_exportable]
    if non_exportable:
        non_exportable_names = [t.name for t in non_exportable]
        raise HTTPException(
            status_code=403,
            detail=f"The following templates are not exportable: {', '.join(non_exportable_names)}",
        )

    # Build export package
    exported_templates = []
    for template in templates:
        export_data = AssignmentTemplateExport(
            name=template.name,
            description=template.description,
            instructions=template.instructions,
            assignment_type=template.assignment_type,
            subject_name=template.subject.name,
            max_points=template.max_points,
            estimated_duration_minutes=template.estimated_duration_minutes,
            prerequisites=template.prerequisites,
            materials_needed=template.materials_needed,
            export_metadata={
                "template_id": template.id,
            },
        )
        exported_templates.append(export_data)

    export_package = {
        "format_version": "1.0",
        "export_timestamp": datetime.now(timezone.utc),
        "exported_by": get_actor_name_from_auth(auth_user),
        "templates": exported_templates,
        "metadata": {
            "template_count": len(exported_templates),
            "subjects": list(set(t.subject.name for t in templates)),
        },
    }

    return export_package
