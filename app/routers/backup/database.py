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

"""APIs for database backup and restore operations."""

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.api_auth import APIKeyUser
from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    get_actor_name_from_auth,
    require_admin_or_permission,
)
from app.models.user import User
from app.schemas.backup import (
    SystemBackup,
    SystemBackupImportRequest,
    SystemBackupImportResult,
)

from .exporters import (
    export_assignment_templates,
    export_assignment_time_entries,
    export_attendance_records,
    export_grade_history,
    export_journal_entries,
    export_lesson_paperless_materials,
    export_lessons,
    export_paperless_doctype_maps,
    export_paperless_documents,
    export_paperless_tag_maps,
    export_point_transactions,
    export_shop_categories,
    export_shop_images,
    export_shop_items,
    export_shop_redemptions,
    export_student_assignment_paperless_materials,
    export_student_assignments,
    export_student_points,
    export_student_term_grades,
    export_subjects,
    export_system_settings,
    export_template_paperless_materials,
    export_term_subjects,
    export_terms,
    export_users,
)
from .importers import WIPE_CONFIRMATION_PHRASE, import_system_data
from .shared import log_backup_operation

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/export", response_model=SystemBackup)
def export_system_backup(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("backup:export"))
    ],
):
    """Export complete system backup for data protection and migration."""

    try:
        actor = get_actor_name_from_auth(auth_user)
        log_backup_operation("export", actor, "Starting complete system backup")

        # Export all data types
        users_data = export_users(db)
        subjects_data = export_subjects(db)
        terms_data = export_terms(db)
        templates_data = export_assignment_templates(db)
        term_subjects_data = export_term_subjects(db)
        student_assignments_data = export_student_assignments(db)
        assignment_time_entries_data = export_assignment_time_entries(db)
        term_grades_data = export_student_term_grades(db)
        grade_history_data = export_grade_history(db)
        attendance_data = export_attendance_records(db)
        journal_data = export_journal_entries(db)
        student_points_data = export_student_points(db)
        point_transactions_data = export_point_transactions(db)
        shop_categories_data = export_shop_categories(db)
        shop_images_data = export_shop_images(db)
        shop_items_data = export_shop_items(db)
        shop_redemptions_data = export_shop_redemptions(db)
        lessons_data = export_lessons(db)
        paperless_tag_maps_data = export_paperless_tag_maps(db)
        paperless_doctype_maps_data = export_paperless_doctype_maps(db)
        paperless_documents_data = export_paperless_documents(db)
        lesson_paperless_data = export_lesson_paperless_materials(db)
        template_paperless_data = export_template_paperless_materials(db)
        sa_paperless_data = export_student_assignment_paperless_materials(db)
        system_settings_data = export_system_settings(db)

        # Create system backup
        backup = SystemBackup(
            format_version="2.2",
            backup_timestamp=datetime.now(timezone.utc),
            created_by=actor,
            system_info={
                "total_users": len(users_data),
                "total_subjects": len(subjects_data),
                "total_assignment_templates": len(templates_data),
                "total_student_assignments": len(student_assignments_data),
                "total_assignment_time_entries": len(assignment_time_entries_data),
                "total_terms": len(terms_data),
                "total_attendance_records": len(attendance_data),
                "total_journal_entries": len(journal_data),
                "total_student_points": len(student_points_data),
                "total_point_transactions": len(point_transactions_data),
                "total_shop_categories": len(shop_categories_data),
                "total_shop_images": len(shop_images_data),
                "total_shop_items": len(shop_items_data),
                "total_shop_redemptions": len(shop_redemptions_data),
                "total_lessons": len(lessons_data),
                "total_paperless_documents": len(paperless_documents_data),
                "total_paperless_attachments": (
                    len(lesson_paperless_data)
                    + len(template_paperless_data)
                    + len(sa_paperless_data)
                ),
                "total_system_settings": len(system_settings_data),
            },
            users=users_data,
            subjects=subjects_data,
            terms=terms_data,
            assignment_templates=templates_data,
            term_subjects=term_subjects_data,
            student_assignments=student_assignments_data,
            assignment_time_entries=assignment_time_entries_data,
            student_term_grades=term_grades_data,
            grade_history=grade_history_data,
            attendance_records=attendance_data,
            journal_entries=journal_data,
            student_points=student_points_data,
            point_transactions=point_transactions_data,
            shop_categories=shop_categories_data,
            shop_images=shop_images_data,
            shop_items=shop_items_data,
            shop_redemptions=shop_redemptions_data,
            lessons=lessons_data,
            paperless_tag_maps=paperless_tag_maps_data,
            paperless_doctype_maps=paperless_doctype_maps_data,
            paperless_documents=paperless_documents_data,
            lesson_paperless_materials=lesson_paperless_data,
            template_paperless_materials=template_paperless_data,
            student_assignment_paperless_materials=sa_paperless_data,
            system_settings=system_settings_data,
        )

        total_objects = sum(backup.system_info.values())
        log_backup_operation(
            "export",
            actor,
            f"Backup completed successfully. Total objects: {total_objects}",
        )
        return backup

    except Exception as e:
        logger.error(f"System backup export failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Backup export failed. See server logs for details."
        )


@router.post("/import", response_model=SystemBackupImportResult)
def import_system_backup(
    import_request: SystemBackupImportRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("backup:import"))
    ],
):
    """Import complete system backup with intelligent conflict resolution."""

    # Wipe-and-restore is destructive; require an explicit typed confirmation
    # in the request body so the API alone can never wipe by accident.
    if import_request.import_options.get("wipe_before_import"):
        if import_request.wipe_confirmation != WIPE_CONFIRMATION_PHRASE:
            raise HTTPException(
                status_code=400,
                detail=(
                    "wipe_before_import requires wipe_confirmation="
                    f"'{WIPE_CONFIRMATION_PHRASE}'"
                ),
            )

    # import_system_data mutates the live User object (for wipe-restore admin
    # preservation), so we need a real User, not an APIKeyUser.
    if isinstance(auth_user, APIKeyUser):
        acting_id = getattr(auth_user, "acting_user_id", None)
        if acting_id is None:
            raise HTTPException(
                status_code=400,
                detail="X-On-Behalf-Of header required for API key backup import",
            )
        import_user = db.query(User).filter(User.id == acting_id).first()
        if not import_user:
            raise HTTPException(status_code=400, detail="On-Behalf-Of user not found")
    else:
        import_user = auth_user  # auth_user is already a User

    actor = get_actor_name_from_auth(auth_user)
    try:
        log_backup_operation("import", actor, "Starting system backup import")

        # Delegate to import handler
        result = import_system_data(
            db, import_request.backup_data, import_user, import_request.import_options
        )

        if result.success:
            total = (
                sum(result.imported_counts.values()) if result.imported_counts else 0
            )
            log_backup_operation(
                "import",
                actor,
                f"Import completed successfully. {total} objects imported",
            )
        else:
            log_backup_operation(
                "import",
                actor,
                f"Import failed with {len(result.errors)} errors",
            )

        return result

    except Exception as e:
        logger.error(f"System backup import failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Backup import failed. See server logs for details."
        )
