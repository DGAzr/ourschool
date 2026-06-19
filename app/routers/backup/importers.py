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
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.enums import UserRole as UserRoleEnum
from app.models.assignment import AssignmentTemplate
from app.models.subject import Subject
from app.models.term import Term
from app.models.user import User
from app.schemas.backup import SystemBackup, SystemBackupImportResult

from .shared import log_backup_operation, sanitize_import_data, validate_backup_data

logger = logging.getLogger(__name__)

# Backup format versions supported by this importer
SUPPORTED_VERSIONS = {"1.0", "2.0"}
LEGACY_VERSIONS = {"1.0"}  # Versions that lack external_id — name-only fallback


def _resolve(external_id: Optional[str], name: str, by_uuid: Dict, by_name: Dict) -> Optional[int]:
    """Resolve an entity to its local DB id. Prefers external_id, falls back to name."""
    if external_id and external_id in by_uuid:
        return by_uuid[external_id]
    return by_name.get(name)


def import_system_data(
    db: Session,
    backup_data: SystemBackup,
    current_user: User,
    import_options: Dict[str, Any] = None
) -> SystemBackupImportResult:
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
        result.import_log.append(f"Starting backup import at {datetime.now(timezone.utc).isoformat()}")

        # Version compatibility check
        version = backup_data.format_version
        if version not in SUPPORTED_VERSIONS:
            result.errors.append(f"Unsupported backup format version: {version}. Supported: {', '.join(sorted(SUPPORTED_VERSIONS))}")
            return result
        if version in LEGACY_VERSIONS:
            result.warnings.append(
                f"Backup is format {version} (legacy). External IDs are not present — "
                "resolution will use names only. Rename conflicts may cause records to be skipped."
            )

        # Validate and sanitize
        validation_errors = validate_backup_data(backup_data.model_dump())
        if validation_errors:
            result.errors.extend(validation_errors)
            return result

        backup_dict = sanitize_import_data(backup_data.model_dump())
        backup_data = SystemBackup(**backup_dict)

        # TODO: Implement "clean_import" option — truncate all data tables in reverse
        # dependency order before importing, preserving only the current admin session user.
        # This is the more honest restore semantics vs. the current merge behavior which
        # allows duplicate records on re-import. Wire to a checkbox in the UI with a warning.

        # Import in dependency order
        _import_users(db, backup_data.users, result, import_options, dry_run)
        _import_subjects(db, backup_data.subjects, result, dry_run)
        _import_terms(db, backup_data.terms, result, dry_run, current_user.id)
        _import_assignment_templates(db, backup_data.assignment_templates, result, dry_run, current_user.id)
        _import_term_subjects(db, backup_data.term_subjects, result, dry_run)
        _import_student_assignments(db, backup_data.student_assignments, result, dry_run, current_user.id)
        _import_student_term_grades(db, backup_data.student_term_grades, result, dry_run)
        _import_grade_history(db, backup_data.grade_history, result, dry_run)
        _import_attendance_records(db, backup_data.attendance_records, result, dry_run)
        _import_journal_entries(db, backup_data.journal_entries, result, dry_run)

        if not dry_run:
            db.commit()
            result.success = True
            result.import_log.append(f"Backup import completed successfully at {datetime.now(timezone.utc).isoformat()}")
        else:
            result.success = True
            result.import_log.append("Dry run completed successfully - no changes made")

        total_imported = sum(result.imported_counts.values())
        log_backup_operation("import", current_user.email, f"Import completed successfully. Imported: {total_imported} objects")
        return result

    except Exception as e:
        if not dry_run:
            db.rollback()
        logger.error(f"System backup import failed: {str(e)}", exc_info=True)
        result.errors.append(f"Import failed: {str(e)}")
        result.import_log.append(f"Import failed with error: {str(e)}")
        return result


def _import_users(db: Session, users_data, result, import_options, dry_run):
    """Import users. Builds two resolution maps: by external_id and by email."""
    by_uuid: Dict[str, int] = {}
    by_email: Dict[str, int] = {}
    imported = skipped = 0

    # Pre-load existing users into both maps
    for existing in db.query(User).all():
        if existing.external_id:
            by_uuid[existing.external_id] = existing.id
        by_email[existing.email] = existing.id

    for user_data in users_data:
        existing_id = _resolve(user_data.external_id, user_data.email, by_uuid, by_email)

        if existing_id and import_options.get("skip_existing_users", True):
            by_uuid[user_data.external_id] = existing_id if user_data.external_id else None
            by_email[user_data.email] = existing_id
            skipped += 1
            result.import_log.append(f"Skipped existing user: {user_data.email}")
            continue

        if not dry_run:
            existing_user = db.query(User).filter(User.id == existing_id).first() if existing_id else None
            if existing_user and import_options.get("update_existing_data", False):
                existing_user.first_name = user_data.first_name
                existing_user.last_name = user_data.last_name
                existing_user.username = user_data.username
                existing_user.role = UserRoleEnum(user_data.role)
                existing_user.is_active = user_data.is_active
                existing_user.date_of_birth = user_data.date_of_birth
                existing_user.grade_level = user_data.grade_level
                db.flush()
                by_email[user_data.email] = existing_user.id
                if user_data.external_id:
                    by_uuid[user_data.external_id] = existing_user.id
                result.import_log.append(f"Updated existing user: {user_data.email}")
            else:
                import uuid as _uuid
                new_user = User(
                    external_id=user_data.external_id or str(_uuid.uuid4()),
                    email=user_data.email,
                    username=user_data.username + "_imported" if existing_user else user_data.username,
                    hashed_password="needs_reset",
                    first_name=user_data.first_name,
                    last_name=user_data.last_name,
                    role=UserRoleEnum(user_data.role),
                    is_active=user_data.is_active,
                    date_of_birth=user_data.date_of_birth,
                    grade_level=user_data.grade_level
                )
                db.add(new_user)
                db.flush()
                by_email[user_data.email] = new_user.id
                by_uuid[new_user.external_id] = new_user.id
                imported += 1
                result.import_log.append(f"Created new user: {user_data.email}")
                result.warnings.append(f"User {user_data.email} will need to reset their password")
        else:
            imported += 1

    result.imported_counts["users"] = imported
    result.skipped_counts["users"] = skipped
    result.id_mappings["users_by_uuid"] = by_uuid
    result.id_mappings["users_by_email"] = by_email


def _import_subjects(db: Session, subjects_data, result, dry_run):
    """Import subjects. Resolution: external_id > name."""
    by_uuid: Dict[str, int] = {}
    by_name: Dict[str, int] = {}
    imported = skipped = 0

    for existing in db.query(Subject).all():
        if existing.external_id:
            by_uuid[existing.external_id] = existing.id
        by_name[existing.name] = existing.id

    for subject_data in subjects_data:
        existing_id = _resolve(subject_data.external_id, subject_data.name, by_uuid, by_name)

        if existing_id:
            by_name[subject_data.name] = existing_id
            if subject_data.external_id:
                by_uuid[subject_data.external_id] = existing_id
            skipped += 1
            result.import_log.append(f"Skipped existing subject: {subject_data.name}")
            continue

        if not dry_run:
            import uuid as _uuid
            new_subject = Subject(
                external_id=subject_data.external_id or str(_uuid.uuid4()),
                name=subject_data.name,
                description=subject_data.description,
                color=subject_data.color
            )
            db.add(new_subject)
            db.flush()
            by_name[new_subject.name] = new_subject.id
            by_uuid[new_subject.external_id] = new_subject.id
            result.import_log.append(f"Created new subject: {subject_data.name}")

        imported += 1

    result.imported_counts["subjects"] = imported
    result.skipped_counts["subjects"] = skipped
    result.id_mappings["subjects_by_uuid"] = by_uuid
    result.id_mappings["subjects_by_name"] = by_name


def _import_terms(db: Session, terms_data, result, dry_run, admin_user_id: int):
    """Import terms. Resolution: external_id > name."""
    by_uuid: Dict[str, int] = {}
    by_name: Dict[str, int] = {}
    imported = skipped = 0

    for existing in db.query(Term).all():
        if existing.external_id:
            by_uuid[existing.external_id] = existing.id
        by_name[existing.name] = existing.id

    for term_data in terms_data:
        existing_id = _resolve(term_data.external_id, term_data.name, by_uuid, by_name)

        if existing_id:
            by_name[term_data.name] = existing_id
            if term_data.external_id:
                by_uuid[term_data.external_id] = existing_id
            skipped += 1
            result.import_log.append(f"Skipped existing term: {term_data.name}")
            continue

        if not dry_run:
            from app.enums import TermType
            import uuid as _uuid

            # academic_year: use backup value if present, derive otherwise
            academic_year = term_data.academic_year
            if not academic_year:
                start = term_data.start_date
                if start.month >= 8:
                    academic_year = f"{start.year}-{start.year + 1}"
                else:
                    academic_year = f"{start.year - 1}-{start.year}"

            new_term = Term(
                external_id=term_data.external_id or str(_uuid.uuid4()),
                name=term_data.name,
                term_type=TermType(term_data.type),
                start_date=term_data.start_date,
                end_date=term_data.end_date,
                academic_year=academic_year,
                created_by=admin_user_id,
            )
            db.add(new_term)
            db.flush()
            by_name[new_term.name] = new_term.id
            by_uuid[new_term.external_id] = new_term.id
            result.import_log.append(f"Created new term: {term_data.name}")

        imported += 1

    result.imported_counts["terms"] = imported
    result.skipped_counts["terms"] = skipped
    result.id_mappings["terms_by_uuid"] = by_uuid
    result.id_mappings["terms_by_name"] = by_name


def _import_assignment_templates(db: Session, templates_data, result, dry_run, admin_user_id: int):
    """Import assignment templates. Resolution: external_id > name."""
    by_uuid: Dict[str, int] = {}
    by_name: Dict[str, int] = {}
    imported = skipped = 0

    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})

    for existing in db.query(AssignmentTemplate).all():
        if existing.external_id:
            by_uuid[existing.external_id] = existing.id
        by_name[existing.name] = existing.id

    for template_data in templates_data:
        existing_id = _resolve(template_data.external_id, template_data.name, by_uuid, by_name)

        if existing_id:
            by_name[template_data.name] = existing_id
            if template_data.external_id:
                by_uuid[template_data.external_id] = existing_id
            skipped += 1
            result.import_log.append(f"Skipped existing template: {template_data.name}")
            continue

        if not dry_run:
            from app.enums import AssignmentType
            import uuid as _uuid

            subject_id = _resolve(
                getattr(template_data, 'subject_external_id', None),
                template_data.subject_name,
                subjects_by_uuid,
                subjects_by_name
            )
            if not subject_id:
                result.import_log.append(f"Skipped template '{template_data.name}': subject '{template_data.subject_name}' not found")
                result.warnings.append(f"Template '{template_data.name}' skipped — subject not found")
                continue

            new_template = AssignmentTemplate(
                external_id=template_data.external_id or str(_uuid.uuid4()),
                name=template_data.name,
                description=template_data.description,
                instructions=template_data.instructions,
                assignment_type=AssignmentType(template_data.assignment_type),
                subject_id=subject_id,
                max_points=template_data.max_points,
                estimated_duration_minutes=template_data.estimated_duration_minutes,
                prerequisites=template_data.prerequisites,
                materials_needed=template_data.materials_needed,
                is_exportable=template_data.is_exportable,
                created_by=admin_user_id,
            )
            db.add(new_template)
            db.flush()
            by_name[new_template.name] = new_template.id
            by_uuid[new_template.external_id] = new_template.id
            result.import_log.append(f"Created new template: {template_data.name}")

        imported += 1

    result.imported_counts["assignment_templates"] = imported
    result.skipped_counts["assignment_templates"] = skipped
    result.id_mappings["templates_by_uuid"] = by_uuid
    result.id_mappings["templates_by_name"] = by_name


def _import_term_subjects(db: Session, term_subjects_data, result, dry_run):
    """Import term-subject relationships."""
    terms_by_uuid = result.id_mappings.get("terms_by_uuid", {})
    terms_by_name = result.id_mappings.get("terms_by_name", {})
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    imported = 0

    for ts_data in term_subjects_data:
        term_id = _resolve(getattr(ts_data, 'term_external_id', None), ts_data.term_name, terms_by_uuid, terms_by_name)
        subject_id = _resolve(getattr(ts_data, 'subject_external_id', None), ts_data.subject_name, subjects_by_uuid, subjects_by_name)

        if not term_id or not subject_id:
            result.import_log.append(f"Skipped term_subject: {ts_data.term_name}/{ts_data.subject_name} (unresolved)")
            result.warnings.append(f"Term-subject '{ts_data.term_name}/{ts_data.subject_name}' skipped — could not resolve term or subject")
            continue

        if not dry_run:
            from app.models.term import TermSubject
            existing = db.query(TermSubject).filter(
                TermSubject.term_id == term_id,
                TermSubject.subject_id == subject_id
            ).first()
            if not existing:
                new_ts = TermSubject(
                    term_id=term_id,
                    subject_id=subject_id,
                    is_active=True,
                    weight=ts_data.weight or 1.0,
                    learning_goals="Imported from backup"
                )
                db.add(new_ts)
                db.flush()
                result.import_log.append(f"Created term_subject: {ts_data.term_name}/{ts_data.subject_name}")
            else:
                result.import_log.append(f"Skipped existing term_subject: {ts_data.term_name}/{ts_data.subject_name}")
        imported += 1

    result.imported_counts["term_subjects"] = imported


def _import_student_assignments(db: Session, student_assignments_data, result, dry_run, admin_user_id: int):
    """Import student assignments."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    templates_by_uuid = result.id_mappings.get("templates_by_uuid", {})
    templates_by_name = result.id_mappings.get("templates_by_name", {})
    imported = 0

    for sa_data in student_assignments_data:
        student_id = _resolve(getattr(sa_data, 'student_external_id', None), sa_data.student_email, users_by_uuid, users_by_email)
        template_id = _resolve(getattr(sa_data, 'template_external_id', None), sa_data.assignment_template_name, templates_by_uuid, templates_by_name)

        if not student_id or not template_id:
            result.import_log.append(f"Skipped student_assignment: {sa_data.student_email}/{sa_data.assignment_template_name} (unresolved)")
            continue

        if not dry_run:
            from app.models.assignment import StudentAssignment
            from app.enums import AssignmentStatus
            new_sa = StudentAssignment(
                template_id=template_id,
                student_id=student_id,
                assigned_date=sa_data.due_date or date.today(),
                due_date=sa_data.due_date,
                extended_due_date=sa_data.extended_due_date,
                status=AssignmentStatus(sa_data.status) if sa_data.status else AssignmentStatus.NOT_STARTED,
                points_earned=sa_data.points_earned,
                letter_grade=sa_data.letter_grade,
                teacher_feedback=sa_data.teacher_feedback,
                student_notes=sa_data.student_notes,
                submission_notes=sa_data.submission_notes,
                custom_instructions=sa_data.custom_instructions,
                custom_max_points=sa_data.custom_max_points,
                assigned_by=admin_user_id,
            )
            db.add(new_sa)
            db.flush()
            result.import_log.append(f"Created student_assignment for {sa_data.student_email}")
        imported += 1

    result.imported_counts["student_assignments"] = imported


def _import_student_term_grades(db: Session, term_grades_data, result, dry_run):
    """Import student term grades."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    imported = 0

    for tg_data in term_grades_data:
        student_id = _resolve(getattr(tg_data, 'student_external_id', None), tg_data.student_email, users_by_uuid, users_by_email)
        if not student_id:
            result.import_log.append(f"Skipped student_term_grade: {tg_data.student_email} (unresolved)")
            continue

        if not dry_run:
            from app.models.term import StudentTermGrade
            new_tg = StudentTermGrade(
                student_id=student_id,
                term_subject_id=0,
                current_points_earned=tg_data.points_earned or 0,
                current_points_possible=tg_data.points_possible or 0,
                current_percentage=tg_data.percentage,
                current_letter_grade=tg_data.grade
            )
            db.add(new_tg)
            db.flush()
            result.import_log.append(f"Created student_term_grade for {tg_data.student_email}")
        imported += 1

    result.imported_counts["student_term_grades"] = imported


def _import_grade_history(db: Session, grade_history_data, result, dry_run):
    """Import grade history."""
    imported = 0
    for gh_data in grade_history_data:
        if not dry_run:
            from app.models.term import GradeHistory
            new_gh = GradeHistory(
                student_id=0,
                term_id=0,
                subject_id=0,
                old_letter_grade=gh_data.grade,
                new_letter_grade=gh_data.grade,
                old_percentage_grade=gh_data.percentage,
                new_percentage_grade=gh_data.percentage,
                change_reason="Imported from backup"
            )
            db.add(new_gh)
            db.flush()
            result.import_log.append("Created grade_history entry")
        imported += 1
    result.imported_counts["grade_history"] = imported


def _import_attendance_records(db: Session, attendance_data, result, dry_run):
    """Import attendance records."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    imported = 0

    for att_data in attendance_data:
        student_id = _resolve(getattr(att_data, 'student_external_id', None), att_data.student_email, users_by_uuid, users_by_email)
        if not student_id:
            result.import_log.append(f"Skipped attendance: {att_data.student_email} (unresolved)")
            continue

        if not dry_run:
            from app.models.attendance import AttendanceRecord
            from app.enums import AttendanceStatus
            new_att = AttendanceRecord(
                student_id=student_id,
                date=att_data.date,
                status=AttendanceStatus(att_data.status) if att_data.status else AttendanceStatus.PRESENT,
                notes=att_data.notes
            )
            db.add(new_att)
            db.flush()
            result.import_log.append(f"Created attendance for {att_data.student_email}")
        imported += 1

    result.imported_counts["attendance_records"] = imported


def _import_journal_entries(db: Session, journal_data, result, dry_run):
    """Import journal entries."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    imported = 0

    for je_data in journal_data:
        author_id = _resolve(getattr(je_data, 'user_external_id', None), je_data.user_email, users_by_uuid, users_by_email)
        if not author_id:
            result.import_log.append(f"Skipped journal: {je_data.user_email} (unresolved)")
            continue

        if not dry_run:
            from app.models.journal import JournalEntry
            new_je = JournalEntry(
                student_id=author_id,
                author_id=author_id,
                title=je_data.title,
                content=je_data.content,
                entry_date=datetime.combine(je_data.date, datetime.min.time()) if isinstance(je_data.date, date) else je_data.date
            )
            db.add(new_je)
            db.flush()
            result.import_log.append(f"Created journal entry: {je_data.title}")
        imported += 1

    result.imported_counts["journal_entries"] = imported
