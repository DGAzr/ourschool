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

"""Data import utilities for backup operations."""
import logging
from datetime import datetime
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.enums import UserRole as UserRoleEnum
from app.models.assignment import AssignmentTemplate
from app.models.lesson import Lesson, LessonAssignment, Subject
from app.models.term import Term
from app.models.user import User
from app.schemas.backup import SystemBackup, SystemBackupImportResult

from .shared import log_backup_operation, sanitize_import_data, validate_backup_data

logger = logging.getLogger(__name__)


def import_system_data(
    db: Session, 
    backup_data: SystemBackup, 
    current_user: User,
    import_options: Dict[str, Any] = None
) -> SystemBackupImportResult:
    """Import complete system backup with conflict resolution.
    
    Args:
        db: Database session
        backup_data: The backup data to import
        current_user: User performing the import
        import_options: Import configuration options
        
    Returns:
        Import result with success status and details
    """
    if import_options is None:
        import_options = {}
        
    dry_run = import_options.get("dry_run", False)
    
    result = SystemBackupImportResult(
        success=False,
        dry_run=dry_run,
        imported_counts={},
        skipped_counts={},
        updated_counts={},
        error_counts={},
        warnings=[],
        errors=[],
        import_log=[],
        id_mappings={}
    )
    
    try:
        log_backup_operation("import", current_user.email, f"Starting system backup import, dry_run={dry_run}")
        result.import_log.append(f"Starting backup import at {datetime.utcnow().isoformat()}")
        
        # Validate backup data
        validation_errors = validate_backup_data(backup_data.dict())
        if validation_errors:
            result.errors.extend(validation_errors)
            return result
        
        # Sanitize data
        backup_dict = sanitize_import_data(backup_data.dict())
        backup_data = SystemBackup(**backup_dict)
        
        if not dry_run:
            db.begin()
        
        # Import in dependency order
        _import_users(db, backup_data.users, result, import_options, dry_run)
        _import_subjects(db, backup_data.subjects, result, dry_run)
        _import_terms(db, backup_data.terms, result, dry_run)
        _import_lessons(db, backup_data.lessons, result, dry_run)
        _import_assignment_templates(db, backup_data.assignment_templates, result, dry_run)
        _import_lesson_assignments(db, backup_data.lesson_assignments, result, dry_run)
        
        # Note: Additional imports would continue here:
        # _import_student_assignments(db, backup_data.student_assignments, result, dry_run)
        # _import_term_subjects(db, backup_data.term_subjects, result, dry_run)
        # _import_student_term_grades(db, backup_data.student_term_grades, result, dry_run)
        # _import_grade_history(db, backup_data.grade_history, result, dry_run)
        # _import_attendance_records(db, backup_data.attendance_records, result, dry_run)
        # _import_journal_entries(db, backup_data.journal_entries, result, dry_run)
        
        if not dry_run:
            db.commit()
            result.success = True
            result.import_log.append(f"Backup import completed successfully at {datetime.utcnow().isoformat()}")
        else:
            result.success = True
            result.import_log.append("Dry run completed successfully - no changes made")
        
        total_imported = sum(result.imported_counts.values())
        log_backup_operation("import", current_user.email, f"Import completed successfully. Imported: {total_imported} objects")
        return result
        
    except Exception as e:
        if not dry_run:
            db.rollback()
        logger.error(f"System backup import failed: {str(e)}")
        result.errors.append(f"Import failed: {str(e)}")
        result.import_log.append(f"Import failed with error: {str(e)}")
        return result


def _import_users(db: Session, users_data, result, import_options, dry_run):
    """Import users with conflict handling."""
    user_mapping = {}
    imported_users = 0
    skipped_users = 0
    
    for user_data in users_data:
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        
        if existing_user and import_options.get("skip_existing_users", True):
            user_mapping[user_data.email] = existing_user.id
            skipped_users += 1
            result.import_log.append(f"Skipped existing user: {user_data.email}")
            continue
        
        if not dry_run:
            if existing_user and import_options.get("update_existing_data", False):
                # Update existing user
                existing_user.first_name = user_data.first_name
                existing_user.last_name = user_data.last_name
                existing_user.username = user_data.username
                existing_user.role = UserRoleEnum(user_data.role)
                existing_user.is_active = user_data.is_active
                existing_user.date_of_birth = user_data.date_of_birth
                existing_user.grade_level = user_data.grade_level
                db.flush()
                user_mapping[user_data.email] = existing_user.id
                result.import_log.append(f"Updated existing user: {user_data.email}")
            else:
                # Create new user (note: password will need to be reset)
                new_user = User(
                    email=user_data.email,
                    username=user_data.username + "_imported" if existing_user else user_data.username,
                    hashed_password="needs_reset",  # Will need password reset
                    first_name=user_data.first_name,
                    last_name=user_data.last_name,
                    role=UserRoleEnum(user_data.role),
                    is_active=user_data.is_active,
                    date_of_birth=user_data.date_of_birth,
                    grade_level=user_data.grade_level
                )
                db.add(new_user)
                db.flush()
                user_mapping[user_data.email] = new_user.id
                imported_users += 1
                result.import_log.append(f"Created new user: {user_data.email}")
                result.warnings.append(f"User {user_data.email} will need to reset their password")
        else:
            imported_users += 1
    
    result.imported_counts["users"] = imported_users
    result.skipped_counts["users"] = skipped_users
    result.id_mappings["users"] = user_mapping


def _import_subjects(db: Session, subjects_data, result, dry_run):
    """Import subjects with conflict handling."""
    subject_mapping = {}
    imported_subjects = 0
    skipped_subjects = 0
    
    for subject_data in subjects_data:
        existing_subject = db.query(Subject).filter(Subject.name == subject_data.name).first()
        
        if existing_subject:
            subject_mapping[subject_data.name] = existing_subject.id
            skipped_subjects += 1
            result.import_log.append(f"Skipped existing subject: {subject_data.name}")
            continue
        
        if not dry_run:
            new_subject = Subject(
                name=subject_data.name,
                description=subject_data.description,
                color=subject_data.color
            )
            db.add(new_subject)
            db.flush()
            subject_mapping[subject_data.name] = new_subject.id
            result.import_log.append(f"Created new subject: {subject_data.name}")
        
        imported_subjects += 1
    
    result.imported_counts["subjects"] = imported_subjects
    result.skipped_counts["subjects"] = skipped_subjects
    result.id_mappings["subjects"] = subject_mapping


def _import_terms(db: Session, terms_data, result, dry_run):
    """Import terms with conflict handling."""
    term_mapping = {}
    imported_terms = 0
    skipped_terms = 0
    
    for term_data in terms_data:
        existing_term = db.query(Term).filter(Term.name == term_data.name).first()
        
        if existing_term:
            term_mapping[term_data.name] = existing_term.id
            skipped_terms += 1
            result.import_log.append(f"Skipped existing term: {term_data.name}")
            continue
        
        if not dry_run:
            from app.enums import TermType
            new_term = Term(
                name=term_data.name,
                type=TermType(term_data.type),
                start_date=term_data.start_date,
                end_date=term_data.end_date,
                is_current=term_data.is_current
            )
            db.add(new_term)
            db.flush()
            term_mapping[term_data.name] = new_term.id
            result.import_log.append(f"Created new term: {term_data.name}")
        
        imported_terms += 1
    
    result.imported_counts["terms"] = imported_terms
    result.skipped_counts["terms"] = skipped_terms
    result.id_mappings["terms"] = term_mapping


def _import_lessons(db: Session, lessons_data, result, dry_run):
    """Import lessons with conflict handling."""
    lesson_mapping = {}
    imported_lessons = 0
    skipped_lessons = 0
    
    for lesson_data in lessons_data:
        existing_lesson = db.query(Lesson).filter(Lesson.title == lesson_data.title).first()
        
        if existing_lesson:
            lesson_mapping[lesson_data.title] = existing_lesson.id
            skipped_lessons += 1
            result.import_log.append(f"Skipped existing lesson: {lesson_data.title}")
            continue
        
        if not dry_run:
            new_lesson = Lesson(
                title=lesson_data.title,
                description=lesson_data.description,
                scheduled_date=lesson_data.scheduled_date,
                start_time=lesson_data.start_time,
                end_time=lesson_data.end_time,
                estimated_duration_minutes=lesson_data.estimated_duration_minutes,
                materials_needed=lesson_data.materials_needed,
                objectives=lesson_data.objectives,
                prerequisites=lesson_data.prerequisites,
                resources=lesson_data.resources,
                lesson_order=lesson_data.lesson_order
            )
            db.add(new_lesson)
            db.flush()
            lesson_mapping[lesson_data.title] = new_lesson.id
            result.import_log.append(f"Created new lesson: {lesson_data.title}")
        
        imported_lessons += 1
    
    result.imported_counts["lessons"] = imported_lessons
    result.skipped_counts["lessons"] = skipped_lessons
    result.id_mappings["lessons"] = lesson_mapping


def _import_assignment_templates(db: Session, templates_data, result, dry_run):
    """Import assignment templates with conflict handling."""
    template_mapping = {}
    imported_templates = 0
    skipped_templates = 0
    
    subject_mapping = result.id_mappings.get("subjects", {})
    
    for template_data in templates_data:
        existing_template = db.query(AssignmentTemplate).filter(
            AssignmentTemplate.name == template_data.name
        ).first()
        
        if existing_template:
            template_mapping[template_data.name] = existing_template.id
            skipped_templates += 1
            result.import_log.append(f"Skipped existing template: {template_data.name}")
            continue
        
        if not dry_run:
            from app.enums import AssignmentType
            
            subject_id = None
            if template_data.subject_name and template_data.subject_name in subject_mapping:
                subject_id = subject_mapping[template_data.subject_name]
            
            new_template = AssignmentTemplate(
                name=template_data.name,
                description=template_data.description,
                instructions=template_data.instructions,
                assignment_type=AssignmentType(template_data.assignment_type),
                subject_id=subject_id,
                max_points=template_data.max_points,
                estimated_duration_minutes=template_data.estimated_duration_minutes,
                prerequisites=template_data.prerequisites,
                materials_needed=template_data.materials_needed,
                auto_assign=template_data.auto_assign,
                auto_assign_days_after=template_data.auto_assign_days_after,
                is_template=template_data.is_template,
                is_recurring=template_data.is_recurring,
                recurrence_pattern=template_data.recurrence_pattern,
                is_draft=template_data.is_draft,
                is_archived=template_data.is_archived,
                tags=template_data.tags,
                created_by=template_data.created_by
            )
            db.add(new_template)
            db.flush()
            template_mapping[template_data.name] = new_template.id
            result.import_log.append(f"Created new template: {template_data.name}")
        
        imported_templates += 1
    
    result.imported_counts["assignment_templates"] = imported_templates
    result.skipped_counts["assignment_templates"] = skipped_templates
    result.id_mappings["assignment_templates"] = template_mapping


def _import_lesson_assignments(db: Session, lesson_assignments_data, result, dry_run):
    """Import lesson assignments with conflict handling."""
    imported_lesson_assignments = 0
    
    lesson_mapping = result.id_mappings.get("lessons", {})
    template_mapping = result.id_mappings.get("assignment_templates", {})
    
    for la_data in lesson_assignments_data:
        lesson_id = lesson_mapping.get(la_data.lesson_title)
        template_id = template_mapping.get(la_data.assignment_template_name)
        
        if not lesson_id or not template_id:
            result.warnings.append(
                f"Skipping lesson assignment: lesson '{la_data.lesson_title}' or template '{la_data.assignment_template_name}' not found"
            )
            continue
        
        existing = db.query(LessonAssignment).filter(
            LessonAssignment.lesson_id == lesson_id,
            LessonAssignment.assignment_template_id == template_id
        ).first()
        
        if existing:
            continue
        
        if not dry_run:
            new_la = LessonAssignment(
                lesson_id=lesson_id,
                assignment_template_id=template_id,
                order_in_lesson=la_data.order_in_lesson,
                planned_duration_minutes=la_data.planned_duration_minutes,
                custom_instructions=la_data.custom_instructions,
                is_required=la_data.is_required,
                custom_max_points=la_data.custom_max_points
            )
            db.add(new_la)
        
        imported_lesson_assignments += 1
    
    result.imported_counts["lesson_assignments"] = imported_lesson_assignments