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
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.schemas.backup import SystemBackup, SystemBackupImportRequest, SystemBackupImportResult

from .exporters import (
    export_assignment_templates,
    export_attendance_records,
    export_grade_history,
    export_journal_entries,
    export_lesson_assignments,
    export_lessons,
    export_student_assignments,
    export_student_term_grades,
    export_subjects,
    export_term_subjects,
    export_terms,
    export_users,
)
from .importers import import_system_data
from .shared import log_backup_operation, require_admin_for_backup

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/export", response_model=SystemBackup)
def export_system_backup(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin_for_backup)],
):
    """Export complete system backup for data protection and migration."""
    
    try:
        log_backup_operation("export", current_user.email, "Starting complete system backup")
        
        # Export all data types
        users_data = export_users(db)
        subjects_data = export_subjects(db)
        terms_data = export_terms(db)
        lessons_data = export_lessons(db)
        templates_data = export_assignment_templates(db)
        lesson_assignments_data = export_lesson_assignments(db)
        term_subjects_data = export_term_subjects(db)
        student_assignments_data = export_student_assignments(db)
        term_grades_data = export_student_term_grades(db)
        grade_history_data = export_grade_history(db)
        attendance_data = export_attendance_records(db)
        journal_data = export_journal_entries(db)
        
        # Create system backup
        backup = SystemBackup(
            format_version="1.0",
            backup_timestamp=datetime.utcnow(),
            created_by=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
            system_info={
                "total_users": len(users_data),
                "total_subjects": len(subjects_data),
                "total_lessons": len(lessons_data),
                "total_assignment_templates": len(templates_data),
                "total_student_assignments": len(student_assignments_data),
                "total_terms": len(terms_data),
                "total_attendance_records": len(attendance_data),
                "total_journal_entries": len(journal_data),
            },
            users=users_data,
            subjects=subjects_data,
            terms=terms_data,
            lessons=lessons_data,
            assignment_templates=templates_data,
            lesson_assignments=lesson_assignments_data,
            term_subjects=term_subjects_data,
            student_assignments=student_assignments_data,
            student_term_grades=term_grades_data,
            grade_history=grade_history_data,
            attendance_records=attendance_data,
            journal_entries=journal_data
        )
        
        total_objects = sum(backup.system_info.values())
        log_backup_operation("export", current_user.email, f"Backup completed successfully. Total objects: {total_objects}")
        return backup
        
    except Exception as e:
        logger.error(f"System backup export failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Backup export failed: {str(e)}"
        )


@router.post("/import", response_model=SystemBackupImportResult)
def import_system_backup(
    import_request: SystemBackupImportRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin_for_backup)],
):
    """Import complete system backup with intelligent conflict resolution."""
    
    try:
        log_backup_operation("import", current_user.email, "Starting system backup import")
        
        # Delegate to import handler
        result = import_system_data(db, import_request.backup_data, current_user)
        
        if result.success:
            log_backup_operation("import", current_user.email, f"Import completed successfully. {len(result.imported_objects)} objects imported")
        else:
            log_backup_operation("import", current_user.email, f"Import failed with {len(result.errors)} errors")
            
        return result
        
    except Exception as e:
        logger.error(f"System backup import failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Backup import failed: {str(e)}"
        )