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

import base64
import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.enums import UserRole as UserRoleEnum
from app.models.api_key import APIKey
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry, JournalReply
from app.models.lesson import Lesson, LessonMaterial, LessonResource, LessonTemplate
from app.models.paperless import (
    LessonPaperlessMaterial,
    PaperlessDoctypeMap,
    PaperlessDocument,
    PaperlessTagMap,
    PaperlessThumbnail,
    StudentAssignmentPaperlessMaterial,
    TemplatePaperlessMaterial,
)
from app.models.points import PointTransaction, StudentPoints, SystemSettings
from app.models.shop import ShopCategory, ShopImage, ShopItem, ShopRedemption
from app.models.subject import Subject
from app.models.term import GradeHistory, StudentTermGrade, Term, TermSubject
from app.models.user import User
from app.schemas.backup import SystemBackup, SystemBackupImportResult

from .shared import log_backup_operation, sanitize_import_data, validate_backup_data

logger = logging.getLogger(__name__)

# Backup format versions supported by this importer
SUPPORTED_VERSIONS = {"1.0", "2.0"}
LEGACY_VERSIONS = {"1.0"}  # Versions that lack external_id — name-only fallback

# Typed phrase required in the request body to arm wipe_before_import.
WIPE_CONFIRMATION_PHRASE = "WIPE ALL DATA"

# Deletion order for wipe-and-restore: children before parents so plain
# DELETEs never trip FK constraints. Covers the backup-scoped tables plus
# journal_replies and grade_history, which are FK children of them but are
# not restorable from a backup. Deliberately absent: assignment_types (the
# importer only auto-creates missing type keys, so wiping would destroy
# display names and icons irrecoverably) and api_keys (standalone system
# credentials, not user-bound — wiping them would break external
# integrations; their created_by FK is ON DELETE SET NULL). Users need
# admin-preservation logic and are handled separately.
_WIPE_ORDER = [
    # Shop children first, and before point_transactions: shop_redemptions has
    # ON DELETE SET NULL FKs into point_transactions, so wiping transactions
    # first would fire those updates mid-wipe.
    ("shop_redemptions", ShopRedemption),
    ("shop_items", ShopItem),
    ("shop_images", ShopImage),
    ("shop_categories", ShopCategory),
    ("point_transactions", PointTransaction),
    ("student_points", StudentPoints),
    ("journal_replies", JournalReply),
    ("journal_entries", JournalEntry),
    ("attendance_records", AttendanceRecord),
    ("grade_history", GradeHistory),
    ("student_term_grades", StudentTermGrade),
    ("term_subjects", TermSubject),
    # Paperless: attachment links first (FK children of lessons/templates/
    # student_assignments AND documents), then the thumbnail cache, then the
    # document cache and mapping tables. paperless_connection is deliberately
    # NOT wiped (mirrors api_keys): it holds live integration credentials that
    # backups never carry, so wiping it would force a pointless reconnect.
    ("student_assignment_paperless_materials", StudentAssignmentPaperlessMaterial),
    ("template_paperless_materials", TemplatePaperlessMaterial),
    ("lesson_paperless_materials", LessonPaperlessMaterial),
    ("paperless_thumbnails", PaperlessThumbnail),
    ("paperless_documents", PaperlessDocument),
    ("paperless_tag_subject_map", PaperlessTagMap),
    ("paperless_doctype_map", PaperlessDoctypeMap),
    # Lesson children first, and lessons before assignment_templates/subjects
    # so their SET NULL FKs never fire mid-wipe. lesson_students association
    # rows are removed by the DB-level CASCADE when lessons are deleted.
    ("lesson_materials", LessonMaterial),
    ("lesson_resources", LessonResource),
    ("lessons_templates", LessonTemplate),
    ("lessons", Lesson),
    ("student_assignments", StudentAssignment),
    ("assignment_templates", AssignmentTemplate),
    ("terms", Term),
    ("subjects", Subject),
    ("system_settings", SystemSettings),
]


def _wipe_for_restore(
    db: Session, current_user: User, result: SystemBackupImportResult, dry_run: bool
) -> None:
    """Delete all backup-scoped data ahead of a restore.

    Runs inside the import transaction, so any later failure rolls the wipe
    back with everything else. The importing admin's row and API keys are
    preserved: backups carry no password hashes, so wiping the current admin
    would leave the system with no working login.
    """
    deleted: Dict[str, int] = {}

    for table_name, model in _WIPE_ORDER:
        query = db.query(model)
        deleted[table_name] = (
            query.count() if dry_run else query.delete(synchronize_session=False)
        )

    # API keys survive the wipe (see _WIPE_ORDER comment). Keys created by
    # wiped users lose their provenance to SET NULL — tell the admin.
    orphaning_keys = (
        db.query(APIKey)
        .filter(APIKey.created_by.isnot(None), APIKey.created_by != current_user.id)
        .count()
    )
    if orphaning_keys:
        result.warnings.append(
            f"{orphaning_keys} API key(s) created by wiped users remain active; "
            "review them under Admin > Integrations and revoke any you no "
            "longer need."
        )

    # Users: two passes for the self-referential parent_id FK (students
    # first, then parents), never deleting the current admin.
    users_query = db.query(User).filter(User.id != current_user.id)
    if dry_run:
        deleted["users"] = users_query.count()
    else:
        if current_user.parent_id is not None:
            current_user.parent_id = None
            db.flush()
        children = users_query.filter(User.parent_id.isnot(None))
        deleted["users"] = children.delete(synchronize_session=False)
        deleted["users"] += users_query.delete(synchronize_session=False)

    result.deleted_counts = deleted

    verb = "Would delete" if dry_run else "Deleted"
    if deleted.get("journal_replies"):
        result.warnings.append(
            f"{verb} {deleted['journal_replies']} journal replies; replies are "
            "not part of backups and cannot be restored."
        )
    if deleted.get("grade_history"):
        result.warnings.append(
            f"{verb} {deleted['grade_history']} grade history records; grade "
            "history is audit data and is not re-imported from backups."
        )

    total = sum(deleted.values())
    tables = sum(1 for count in deleted.values() if count)
    log_backup_operation(
        "import",
        current_user.email,
        f"WIPE-AND-RESTORE ({'dry run' if dry_run else 'executing'}): "
        f"{verb.lower()} {total} rows across {tables} tables before import",
    )
    result.import_log.append(
        f"Wipe-and-restore: {verb.lower()} {total} rows across {tables} tables; "
        f"preserved current admin account ({current_user.email})."
    )


def _resolve(
    external_id: Optional[str], name: str, by_uuid: Dict, by_name: Dict
) -> Optional[int]:
    """Resolve an entity to its local DB id. Prefers external_id, falls back to name."""
    if external_id and external_id in by_uuid:
        return by_uuid[external_id]
    return by_name.get(name)


def import_system_data(
    db: Session,
    backup_data: SystemBackup,
    current_user: User,
    import_options: Dict[str, Any] = None,
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
        id_mappings={},
    )

    try:
        log_backup_operation(
            "import",
            current_user.email,
            f"Starting system backup import, dry_run={dry_run}",
        )
        result.import_log.append(
            f"Starting backup import at {datetime.now(timezone.utc).isoformat()}"
        )

        # Version compatibility check
        version = backup_data.format_version
        if version not in SUPPORTED_VERSIONS:
            result.errors.append(
                f"Unsupported backup format version: {version}. Supported: {', '.join(sorted(SUPPORTED_VERSIONS))}"
            )
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

        # Default restore semantics are MERGE: existing records (matched by
        # external_id, then by natural key) are skipped or updated per
        # import_options; nothing is deleted. With wipe_before_import (gated
        # by a typed confirmation at the endpoint), all backup-scoped data is
        # deleted first — except the importing admin — for true
        # point-in-time restore semantics.
        if import_options.get("wipe_before_import", False):
            _wipe_for_restore(db, current_user, result, dry_run)
            if dry_run:
                result.warnings.append(
                    "Dry-run preview simulates a merge against current data; "
                    "after a real wipe, records reported as skipped-existing "
                    "will be imported instead."
                )

        # Import in dependency order
        _import_users(
            db, backup_data.users, result, import_options, dry_run, current_user
        )
        _import_subjects(db, backup_data.subjects, result, dry_run)
        _import_terms(db, backup_data.terms, result, dry_run, current_user.id)
        _import_assignment_templates(
            db, backup_data.assignment_templates, result, dry_run, current_user.id
        )
        _import_term_subjects(db, backup_data.term_subjects, result, dry_run)
        _import_student_assignments(
            db, backup_data.student_assignments, result, dry_run, current_user.id
        )
        _import_student_term_grades(
            db, backup_data.student_term_grades, result, dry_run
        )
        _import_grade_history(db, backup_data.grade_history, result, dry_run)
        _import_attendance_records(db, backup_data.attendance_records, result, dry_run)
        _import_journal_entries(db, backup_data.journal_entries, result, dry_run)
        # Shop catalog before student_points: goal_item_external_id resolves
        # through the shop-items id map. (Items only depend on categories;
        # redemptions stay later since they also need nothing beyond users.)
        _import_shop_categories(db, backup_data.shop_categories, result, dry_run)
        _import_shop_images(db, backup_data.shop_images, result, dry_run)
        _import_shop_items(db, backup_data.shop_items, result, dry_run)
        _import_student_points(db, backup_data.student_points, result, dry_run)
        _import_point_transactions(db, backup_data.point_transactions, result, dry_run)
        _import_shop_redemptions(db, backup_data.shop_redemptions, result, dry_run)
        # Lessons last among data sections: they remap through the users,
        # subjects, and assignment-template maps built above.
        _import_lessons(db, backup_data.lessons, result, dry_run)
        # Paperless after lessons: attachment links resolve through the
        # lessons/templates/users maps plus the document map built here.
        _import_paperless_maps(
            db,
            backup_data.paperless_tag_maps,
            backup_data.paperless_doctype_maps,
            result,
            dry_run,
        )
        _import_paperless_documents(
            db, backup_data.paperless_documents, result, dry_run
        )
        _import_lesson_paperless_materials(
            db, backup_data.lesson_paperless_materials, result, dry_run
        )
        _import_template_paperless_materials(
            db, backup_data.template_paperless_materials, result, dry_run
        )
        _import_student_assignment_paperless_materials(
            db, backup_data.student_assignment_paperless_materials, result, dry_run
        )
        _import_system_settings(db, backup_data.system_settings, result, dry_run)

        if not dry_run:
            db.commit()
            result.success = True
            result.import_log.append(
                f"Backup import completed successfully at {datetime.now(timezone.utc).isoformat()}"
            )
        else:
            result.success = True
            result.import_log.append("Dry run completed successfully - no changes made")

        total_imported = sum(result.imported_counts.values())
        log_backup_operation(
            "import",
            current_user.email,
            f"Import completed successfully. Imported: {total_imported} objects",
        )
        return result

    except Exception as e:
        if not dry_run:
            db.rollback()
        logger.error(f"System backup import failed: {str(e)}", exc_info=True)
        result.errors.append("Import failed due to an internal error. See server logs.")
        result.import_log.append("Import failed with an internal error.")
        return result


def _import_users(
    db: Session, users_data, result, import_options, dry_run, current_user
):
    """Import users. Builds two resolution maps: by external_id and by email."""
    by_uuid: Dict[str, int] = {}
    by_email: Dict[str, int] = {}
    imported = skipped = updated = 0
    allow_admin_import = import_options.get("allow_admin_import", False)
    wipe_mode = import_options.get("wipe_before_import", False)

    # Pre-load existing users into both maps
    for existing in db.query(User).all():
        if existing.external_id:
            by_uuid[existing.external_id] = existing.id
        by_email[existing.email] = existing.id

    for user_data in users_data:
        existing_id = _resolve(
            user_data.external_id, user_data.email, by_uuid, by_email
        )

        # Validate the role explicitly so a malformed/tampered backup fails with
        # a clear per-record error rather than an opaque mid-import exception.
        try:
            role = UserRoleEnum(user_data.role)
        except ValueError:
            result.errors.append(
                f"User {user_data.email}: invalid role '{user_data.role}'"
            )
            continue

        # In wipe mode the current admin survived the wipe: refresh their
        # profile from the backup but never touch credentials, role, or the
        # username/email the active session is bound to.
        if wipe_mode and existing_id == current_user.id:
            if not dry_run:
                current_user.first_name = user_data.first_name
                current_user.last_name = user_data.last_name
                current_user.date_of_birth = user_data.date_of_birth
                current_user.grade_level = user_data.grade_level
                current_user.theme_preference = user_data.theme_preference
                db.flush()
            if user_data.external_id:
                by_uuid[user_data.external_id] = existing_id
            by_email[user_data.email] = existing_id
            updated += 1
            result.import_log.append(
                f"Preserved current admin account and credentials: "
                f"{current_user.email}"
            )
            continue

        if existing_id and import_options.get("skip_existing_users", True):
            if user_data.external_id:
                by_uuid[user_data.external_id] = existing_id
            by_email[user_data.email] = existing_id
            skipped += 1
            result.import_log.append(f"Skipped existing user: {user_data.email}")
            continue

        # Guard against a backup silently provisioning new admin accounts.
        if role == UserRoleEnum.ADMIN and not existing_id and not allow_admin_import:
            skipped += 1
            result.warnings.append(
                f"User {user_data.email} (role=admin) not created — set "
                "import option allow_admin_import=true to import admin accounts."
            )
            continue

        if not dry_run:
            existing_user = (
                db.query(User).filter(User.id == existing_id).first()
                if existing_id
                else None
            )
            if existing_user and import_options.get("update_existing_data", False):
                existing_user.first_name = user_data.first_name
                existing_user.last_name = user_data.last_name
                existing_user.username = user_data.username
                existing_user.role = role
                existing_user.is_active = user_data.is_active
                existing_user.date_of_birth = user_data.date_of_birth
                existing_user.grade_level = user_data.grade_level
                existing_user.theme_preference = user_data.theme_preference
                db.flush()
                by_email[user_data.email] = existing_user.id
                if user_data.external_id:
                    by_uuid[user_data.external_id] = existing_user.id
                updated += 1
                result.import_log.append(f"Updated existing user: {user_data.email}")
            else:
                import uuid as _uuid

                new_user = User(
                    external_id=user_data.external_id or str(_uuid.uuid4()),
                    email=user_data.email,
                    username=(
                        user_data.username + "_imported"
                        if existing_user
                        else user_data.username
                    ),
                    hashed_password="needs_reset",
                    first_name=user_data.first_name,
                    last_name=user_data.last_name,
                    role=role,
                    is_active=user_data.is_active,
                    date_of_birth=user_data.date_of_birth,
                    grade_level=user_data.grade_level,
                    theme_preference=user_data.theme_preference,
                )
                db.add(new_user)
                db.flush()
                by_email[user_data.email] = new_user.id
                by_uuid[new_user.external_id] = new_user.id
                imported += 1
                result.import_log.append(f"Created new user: {user_data.email}")
                result.warnings.append(
                    f"User {user_data.email} will need to reset their password"
                )
        else:
            imported += 1

    result.imported_counts["users"] = imported
    result.skipped_counts["users"] = skipped
    result.updated_counts["users"] = updated
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
        existing_id = _resolve(
            subject_data.external_id, subject_data.name, by_uuid, by_name
        )

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
                color=subject_data.color,
                icon=getattr(subject_data, "icon", None),
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


def _import_assignment_templates(
    db: Session, templates_data, result, dry_run, admin_user_id: int
):
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
        existing_id = _resolve(
            template_data.external_id, template_data.name, by_uuid, by_name
        )

        if existing_id:
            by_name[template_data.name] = existing_id
            if template_data.external_id:
                by_uuid[template_data.external_id] = existing_id
            skipped += 1
            result.import_log.append(f"Skipped existing template: {template_data.name}")
            continue

        if not dry_run:
            import uuid as _uuid

            from app.crud import assignment_types as crud_types
            from app.schemas.assignment_type import AssignmentTypeCreate

            subject_id = _resolve(
                getattr(template_data, "subject_external_id", None),
                template_data.subject_name,
                subjects_by_uuid,
                subjects_by_name,
            )
            if not subject_id:
                result.import_log.append(
                    f"Skipped template '{template_data.name}': subject '{template_data.subject_name}' not found"
                )
                result.warnings.append(
                    f"Template '{template_data.name}' skipped — subject not found"
                )
                continue

            # Resolve the assignment type, creating it when the backup came from
            # a family that defined a type we don't have locally.
            type_key = template_data.assignment_type or "homework"
            if crud_types.get_by_key(db, type_key) is None:
                created_type = crud_types.create_assignment_type(
                    db,
                    AssignmentTypeCreate(
                        key=type_key,
                        name=type_key.replace("_", " ").title(),
                    ),
                )
                type_key = created_type.key

            new_template = AssignmentTemplate(
                external_id=template_data.external_id or str(_uuid.uuid4()),
                name=template_data.name,
                description=template_data.description,
                instructions=template_data.instructions,
                assignment_type=type_key,
                subject_id=subject_id,
                icon=getattr(template_data, "icon", None),
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
        term_id = _resolve(
            getattr(ts_data, "term_external_id", None),
            ts_data.term_name,
            terms_by_uuid,
            terms_by_name,
        )
        subject_id = _resolve(
            getattr(ts_data, "subject_external_id", None),
            ts_data.subject_name,
            subjects_by_uuid,
            subjects_by_name,
        )

        if not term_id or not subject_id:
            result.import_log.append(
                f"Skipped term_subject: {ts_data.term_name}/{ts_data.subject_name} (unresolved)"
            )
            result.warnings.append(
                f"Term-subject '{ts_data.term_name}/{ts_data.subject_name}' skipped — could not resolve term or subject"
            )
            continue

        if not dry_run:
            from app.models.term import TermSubject

            existing = (
                db.query(TermSubject)
                .filter(
                    TermSubject.term_id == term_id, TermSubject.subject_id == subject_id
                )
                .first()
            )
            if not existing:
                new_ts = TermSubject(
                    term_id=term_id,
                    subject_id=subject_id,
                    is_active=True,
                    weight=ts_data.weight or 1.0,
                    learning_goals="Imported from backup",
                )
                db.add(new_ts)
                db.flush()
                result.import_log.append(
                    f"Created term_subject: {ts_data.term_name}/{ts_data.subject_name}"
                )
            else:
                result.import_log.append(
                    f"Skipped existing term_subject: {ts_data.term_name}/{ts_data.subject_name}"
                )
        imported += 1

    result.imported_counts["term_subjects"] = imported


def _import_student_assignments(
    db: Session, student_assignments_data, result, dry_run, admin_user_id: int
):
    """Import student assignments."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    templates_by_uuid = result.id_mappings.get("templates_by_uuid", {})
    templates_by_name = result.id_mappings.get("templates_by_name", {})
    imported = skipped = 0

    for sa_data in student_assignments_data:
        student_id = _resolve(
            getattr(sa_data, "student_external_id", None),
            sa_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        template_id = _resolve(
            getattr(sa_data, "template_external_id", None),
            sa_data.assignment_template_name,
            templates_by_uuid,
            templates_by_name,
        )

        if not student_id or not template_id:
            result.import_log.append(
                f"Skipped student_assignment: {sa_data.student_email}/{sa_data.assignment_template_name} (unresolved)"
            )
            continue

        if not dry_run:
            from app.models.assignment import StudentAssignment
            from app.enums import AssignmentStatus

            # Idempotency: skip if this student already has this template on this
            # due date, so re-importing a backup does not duplicate assignments.
            existing = (
                db.query(StudentAssignment)
                .filter(
                    StudentAssignment.student_id == student_id,
                    StudentAssignment.template_id == template_id,
                    StudentAssignment.due_date == sa_data.due_date,
                )
                .first()
            )
            if existing:
                skipped += 1
                result.import_log.append(
                    f"Skipped existing student_assignment for {sa_data.student_email}"
                )
                continue

            new_sa = StudentAssignment(
                template_id=template_id,
                student_id=student_id,
                assigned_date=sa_data.due_date or date.today(),
                due_date=sa_data.due_date,
                extended_due_date=sa_data.extended_due_date,
                status=(
                    AssignmentStatus(sa_data.status)
                    if sa_data.status
                    else AssignmentStatus.NOT_STARTED
                ),
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

            # The backup format only carries status + points, not the derived
            # grading fields. Reconstruct them so imported grades are complete:
            # an assignment with a score and GRADED status is a graded grade.
            if (
                new_sa.points_earned is not None
                and new_sa.status == AssignmentStatus.GRADED
            ):
                new_sa.is_graded = True
                new_sa.graded_date = (
                    new_sa.due_date or new_sa.assigned_date or date.today()
                )
                new_sa.calculate_percentage_grade()
                db.flush()

            result.import_log.append(
                f"Created student_assignment for {sa_data.student_email}"
            )
        imported += 1

    result.imported_counts["student_assignments"] = imported
    result.skipped_counts["student_assignments"] = skipped


def _import_student_term_grades(db: Session, term_grades_data, result, dry_run):
    """Import student term grades."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    terms_by_uuid = result.id_mappings.get("terms_by_uuid", {})
    terms_by_name = result.id_mappings.get("terms_by_name", {})
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    imported = skipped = 0

    for tg_data in term_grades_data:
        student_id = _resolve(
            getattr(tg_data, "student_external_id", None),
            tg_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        term_id = _resolve(
            getattr(tg_data, "term_external_id", None),
            tg_data.term_name,
            terms_by_uuid,
            terms_by_name,
        )
        subject_id = _resolve(
            getattr(tg_data, "subject_external_id", None),
            tg_data.subject_name,
            subjects_by_uuid,
            subjects_by_name,
        )

        if not student_id or not term_id or not subject_id:
            result.import_log.append(
                f"Skipped student_term_grade: {tg_data.student_email}/{tg_data.term_name}/{tg_data.subject_name} (unresolved)"
            )
            result.warnings.append(
                f"StudentTermGrade for {tg_data.student_email} skipped — could not resolve student, term, or subject"
            )
            continue

        if not dry_run:
            from app.models.term import StudentTermGrade, TermSubject

            term_subject = (
                db.query(TermSubject)
                .filter(
                    TermSubject.term_id == term_id, TermSubject.subject_id == subject_id
                )
                .first()
            )
            if not term_subject:
                result.import_log.append(
                    f"Skipped student_term_grade: {tg_data.term_name}/{tg_data.subject_name} (TermSubject not found)"
                )
                result.warnings.append(
                    f"StudentTermGrade for {tg_data.student_email} skipped — TermSubject {tg_data.term_name}/{tg_data.subject_name} not found"
                )
                continue

            existing = (
                db.query(StudentTermGrade)
                .filter(
                    StudentTermGrade.student_id == student_id,
                    StudentTermGrade.term_subject_id == term_subject.id,
                )
                .first()
            )
            if existing:
                skipped += 1
                result.import_log.append(
                    f"Skipped existing student_term_grade for {tg_data.student_email}"
                )
                continue

            new_tg = StudentTermGrade(
                student_id=student_id,
                term_subject_id=term_subject.id,
                current_points_earned=tg_data.current_points_earned,
                current_points_possible=tg_data.current_points_possible,
                current_percentage=tg_data.current_percentage,
                current_letter_grade=tg_data.current_letter_grade,
                final_points_earned=tg_data.final_points_earned,
                final_points_possible=tg_data.final_points_possible,
                final_percentage=tg_data.final_percentage,
                final_letter_grade=tg_data.final_letter_grade,
                is_finalized=tg_data.is_finalized,
                assignments_completed=tg_data.assignments_completed,
                assignments_total=tg_data.assignments_total,
                progress_notes=tg_data.progress_notes,
            )
            db.add(new_tg)
            db.flush()
            result.import_log.append(
                f"Created student_term_grade for {tg_data.student_email}/{tg_data.term_name}/{tg_data.subject_name}"
            )
        imported += 1

    result.imported_counts["student_term_grades"] = imported
    result.skipped_counts["student_term_grades"] = skipped


def _import_grade_history(db: Session, grade_history_data, result, dry_run):
    """Grade history is audit data — exported for archival but not re-imported."""
    count = len(grade_history_data) if grade_history_data else 0
    if count:
        result.warnings.append(
            f"{count} grade_history entries present in backup but not imported (audit data — grades are restored via student_term_grades)"
        )
    result.imported_counts["grade_history"] = 0
    result.skipped_counts["grade_history"] = count


def _import_attendance_records(db: Session, attendance_data, result, dry_run):
    """Import attendance records."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    imported = skipped = 0

    for att_data in attendance_data:
        student_id = _resolve(
            getattr(att_data, "student_external_id", None),
            att_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        if not student_id:
            result.import_log.append(
                f"Skipped attendance: {att_data.student_email} (unresolved)"
            )
            continue

        if not dry_run:
            from app.models.attendance import AttendanceRecord
            from app.enums import AttendanceStatus

            # Idempotency: one record per student per day.
            existing = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.date == att_data.date,
                )
                .first()
            )
            if existing:
                skipped += 1
                result.import_log.append(
                    f"Skipped existing attendance for {att_data.student_email} on {att_data.date}"
                )
                continue

            new_att = AttendanceRecord(
                student_id=student_id,
                date=att_data.date,
                status=(
                    AttendanceStatus(att_data.status)
                    if att_data.status
                    else AttendanceStatus.PRESENT
                ),
                notes=att_data.notes,
            )
            db.add(new_att)
            db.flush()
            result.import_log.append(f"Created attendance for {att_data.student_email}")
        imported += 1

    result.imported_counts["attendance_records"] = imported
    result.skipped_counts["attendance_records"] = skipped


def _import_journal_entries(db: Session, journal_data, result, dry_run):
    """Import journal entries."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    imported = skipped = 0

    for je_data in journal_data:
        author_id = _resolve(
            getattr(je_data, "user_external_id", None),
            je_data.user_email,
            users_by_uuid,
            users_by_email,
        )
        if not author_id:
            result.import_log.append(
                f"Skipped journal: {je_data.user_email} (unresolved)"
            )
            continue

        entry_date = (
            datetime.combine(je_data.date, datetime.min.time())
            if isinstance(je_data.date, date)
            else je_data.date
        )

        if not dry_run:
            from app.models.journal import JournalEntry

            # Idempotency: dedup on (author, title, entry_date).
            existing = (
                db.query(JournalEntry)
                .filter(
                    JournalEntry.author_id == author_id,
                    JournalEntry.title == je_data.title,
                    JournalEntry.entry_date == entry_date,
                )
                .first()
            )
            if existing:
                skipped += 1
                result.import_log.append(
                    f"Skipped existing journal entry: {je_data.title}"
                )
                continue

            new_je = JournalEntry(
                student_id=author_id,
                author_id=author_id,
                title=je_data.title,
                content=je_data.content,
                entry_date=entry_date,
            )
            db.add(new_je)
            db.flush()
            result.import_log.append(f"Created journal entry: {je_data.title}")
        imported += 1

    result.imported_counts["journal_entries"] = imported
    result.skipped_counts["journal_entries"] = skipped


def _import_system_settings(db: Session, system_settings_data, result, dry_run):
    """Import system settings. Skips keys that already exist."""
    imported = skipped = 0
    for ss_data in system_settings_data:
        if not dry_run:
            from app.models.points import SystemSettings

            existing = (
                db.query(SystemSettings)
                .filter(SystemSettings.setting_key == ss_data.setting_key)
                .first()
            )
            if existing:
                skipped += 1
                result.import_log.append(
                    f"Skipped existing system_setting: {ss_data.setting_key}"
                )
                continue
            new_ss = SystemSettings(
                setting_key=ss_data.setting_key,
                setting_value=ss_data.setting_value,
                setting_type=ss_data.setting_type,
                description=ss_data.description,
                is_active=ss_data.is_active,
            )
            db.add(new_ss)
            db.flush()
            result.import_log.append(f"Created system_setting: {ss_data.setting_key}")
        imported += 1
    result.imported_counts["system_settings"] = imported
    result.skipped_counts["system_settings"] = skipped


def _import_student_points(db: Session, student_points_data, result, dry_run):
    """Import student point balances. One record per student — skips if already exists.

    Runs after _import_shop_items so the saving-toward goal can be remapped
    through the shop-items id map; an unresolvable goal item leaves the goal
    NULL with a warning.
    """
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    items_by_uuid = result.id_mappings.get("shop_items_by_uuid", {})
    imported = skipped = 0

    for sp_data in student_points_data:
        student_id = _resolve(
            getattr(sp_data, "student_external_id", None),
            sp_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        if not student_id:
            result.import_log.append(
                f"Skipped student_points: {sp_data.student_email} (unresolved)"
            )
            continue

        goal_item_id = None
        goal_external_id = getattr(sp_data, "goal_item_external_id", None)
        if goal_external_id:
            goal_item_id = items_by_uuid.get(goal_external_id)
            if goal_item_id is None:
                # Fall back to a live lookup (item may have pre-existed the wipe).
                item = (
                    db.query(ShopItem)
                    .filter(ShopItem.external_id == goal_external_id)
                    .first()
                )
                goal_item_id = item.id if item else None
            if goal_item_id is None:
                result.warnings.append(
                    f"Student points for {sp_data.student_email}: goal shop "
                    "item not found — goal left unset"
                )

        if not dry_run:
            from app.models.points import StudentPoints

            existing = (
                db.query(StudentPoints)
                .filter(StudentPoints.student_id == student_id)
                .first()
            )
            if existing:
                skipped += 1
                result.import_log.append(
                    f"Skipped existing student_points for {sp_data.student_email}"
                )
                continue
            new_sp = StudentPoints(
                student_id=student_id,
                current_balance=sp_data.current_balance,
                total_earned=sp_data.total_earned,
                total_spent=sp_data.total_spent,
                goal_item_id=goal_item_id,
            )
            db.add(new_sp)
            db.flush()
            result.import_log.append(
                f"Created student_points for {sp_data.student_email}"
            )
        imported += 1

    result.imported_counts["student_points"] = imported
    result.skipped_counts["student_points"] = skipped


def _import_point_transactions(db: Session, point_transactions_data, result, dry_run):
    """Import point transactions. Deduplicates on (student_id, amount, transaction_type, created_at)."""
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    imported = skipped = 0

    for tx_data in point_transactions_data:
        student_id = _resolve(
            getattr(tx_data, "student_external_id", None),
            tx_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        if not student_id:
            result.import_log.append(
                f"Skipped point_transaction: {tx_data.student_email} (unresolved)"
            )
            continue

        if not dry_run:
            from app.models.points import PointTransaction

            existing = (
                db.query(PointTransaction)
                .filter(
                    PointTransaction.student_id == student_id,
                    PointTransaction.amount == tx_data.amount,
                    PointTransaction.transaction_type == tx_data.transaction_type,
                    PointTransaction.created_at == tx_data.created_at,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue
            new_tx = PointTransaction(
                student_id=student_id,
                amount=tx_data.amount,
                transaction_type=tx_data.transaction_type,
                source_description=tx_data.source_description,
                notes=tx_data.notes,
                created_at=tx_data.created_at,
            )
            db.add(new_tx)
            db.flush()
            result.import_log.append(
                f"Created point_transaction for {tx_data.student_email}: {tx_data.amount} pts ({tx_data.transaction_type})"
            )
        imported += 1

    result.imported_counts["point_transactions"] = imported
    result.skipped_counts["point_transactions"] = skipped


def _import_shop_categories(db: Session, categories_data, result, dry_run):
    """Import shop categories. Dedup on external_id; records id mapping."""
    by_uuid: Dict[str, int] = {}
    imported = skipped = 0

    for cat_data in categories_data:
        existing = (
            db.query(ShopCategory)
            .filter(ShopCategory.external_id == cat_data.external_id)
            .first()
        )
        if existing:
            by_uuid[cat_data.external_id] = existing.id
            skipped += 1
            continue
        if not dry_run:
            new_cat = ShopCategory(
                external_id=cat_data.external_id,
                name=cat_data.name,
                color=cat_data.color,
                icon=cat_data.icon,
                sort_order=cat_data.sort_order,
                created_at=cat_data.created_at,
            )
            db.add(new_cat)
            db.flush()
            by_uuid[cat_data.external_id] = new_cat.id
        imported += 1

    result.id_mappings["shop_categories_by_uuid"] = by_uuid
    result.imported_counts["shop_categories"] = imported
    result.skipped_counts["shop_categories"] = skipped


def _import_shop_images(db: Session, images_data, result, dry_run):
    """Import shop images (base64 -> bytes). Dedup on external_id."""
    imported = skipped = 0

    for img_data in images_data:
        existing = (
            db.query(ShopImage)
            .filter(ShopImage.external_id == img_data.external_id)
            .first()
        )
        if existing:
            skipped += 1
            continue
        if not dry_run:
            new_img = ShopImage(
                external_id=img_data.external_id,
                mime_type=img_data.mime_type,
                size_bytes=img_data.size_bytes,
                data=base64.b64decode(img_data.data_b64),
                created_at=img_data.created_at,
            )
            db.add(new_img)
            db.flush()
        imported += 1

    result.imported_counts["shop_images"] = imported
    result.skipped_counts["shop_images"] = skipped


def _import_shop_items(db: Session, items_data, result, dry_run):
    """Import shop items. Resolves category by external_id; dedup on external_id."""
    categories_by_uuid = result.id_mappings.get("shop_categories_by_uuid", {})
    by_uuid: Dict[str, int] = {}
    imported = skipped = 0

    for item_data in items_data:
        existing = (
            db.query(ShopItem)
            .filter(ShopItem.external_id == item_data.external_id)
            .first()
        )
        if existing:
            by_uuid[item_data.external_id] = existing.id
            skipped += 1
            continue

        category_id = categories_by_uuid.get(item_data.category_external_id)
        if category_id is None:
            # Fall back to a live lookup (category may have pre-existed the wipe).
            category = (
                db.query(ShopCategory)
                .filter(ShopCategory.external_id == item_data.category_external_id)
                .first()
            )
            category_id = category.id if category else None
        if category_id is None:
            result.import_log.append(
                f"Skipped shop_item {item_data.name}: category unresolved"
            )
            continue

        if not dry_run:
            new_item = ShopItem(
                external_id=item_data.external_id,
                name=item_data.name,
                category_id=category_id,
                description=item_data.description,
                cost_points=item_data.cost_points,
                quantity_available=item_data.quantity_available,
                fulfillment_type=item_data.fulfillment_type,
                is_active=item_data.is_active,
                display_order=item_data.display_order,
                image_ids=list(item_data.image_ids or []),
                total_redeemed=item_data.total_redeemed,
                created_at=item_data.created_at,
                updated_at=item_data.updated_at,
            )
            db.add(new_item)
            db.flush()
            by_uuid[item_data.external_id] = new_item.id
        imported += 1

    result.id_mappings["shop_items_by_uuid"] = by_uuid
    result.imported_counts["shop_items"] = imported
    result.skipped_counts["shop_items"] = skipped


def _import_shop_redemptions(db: Session, redemptions_data, result, dry_run):
    """Import shop redemptions.

    Resolves student like _import_student_points and item by external_id (a
    missing item just leaves item_id NULL — the snapshot preserves display).
    Transaction-link FKs and decided_by are not restored (no stable txn
    external id); ledger totals still restore via student_points +
    point_transactions.
    """
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    items_by_uuid = result.id_mappings.get("shop_items_by_uuid", {})
    imported = skipped = 0

    for r_data in redemptions_data:
        existing = (
            db.query(ShopRedemption)
            .filter(ShopRedemption.external_id == r_data.external_id)
            .first()
        )
        if existing:
            skipped += 1
            continue

        student_id = _resolve(
            getattr(r_data, "student_external_id", None),
            r_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        if not student_id:
            result.import_log.append(
                f"Skipped shop_redemption: {r_data.student_email} (unresolved)"
            )
            continue

        item_id = None
        if r_data.item_external_id:
            item_id = items_by_uuid.get(r_data.item_external_id)
            if item_id is None:
                item = (
                    db.query(ShopItem)
                    .filter(ShopItem.external_id == r_data.item_external_id)
                    .first()
                )
                item_id = item.id if item else None

        if not dry_run:
            new_r = ShopRedemption(
                external_id=r_data.external_id,
                student_id=student_id,
                item_id=item_id,
                item_name=r_data.item_name,
                cost_points=r_data.cost_points,
                fulfillment_type=r_data.fulfillment_type,
                status=r_data.status,
                created_at=r_data.created_at,
                decided_at=r_data.decided_at,
                fulfilled_at=r_data.fulfilled_at,
            )
            db.add(new_r)
            db.flush()
        imported += 1

    result.imported_counts["shop_redemptions"] = imported
    result.skipped_counts["shop_redemptions"] = skipped


def _import_lessons(db: Session, lessons_data, result, dry_run):
    """Import lessons with nested students/templates/materials/resources.

    Dedup on external_id. Subject and creator resolve through the maps built
    by _import_subjects/_import_users; both are SET NULL FKs on the model, so
    an unresolvable reference degrades to an un-linked lesson (with a log
    entry) rather than a skip. Unresolvable students are dropped with a
    warning; unresolvable template links are kept with template_id NULL,
    matching what deleting the template would have produced.
    """
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    templates_by_uuid = result.id_mappings.get("templates_by_uuid", {})
    templates_by_name = result.id_mappings.get("templates_by_name", {})
    by_uuid: Dict[str, int] = {}
    imported = skipped = 0

    for l_data in lessons_data:
        existing = (
            db.query(Lesson).filter(Lesson.external_id == l_data.external_id).first()
        )
        if existing:
            by_uuid[l_data.external_id] = existing.id
            skipped += 1
            result.import_log.append(f"Skipped existing lesson: {l_data.title}")
            continue

        subject_id = None
        if l_data.subject_external_id or l_data.subject_name:
            subject_id = _resolve(
                l_data.subject_external_id,
                l_data.subject_name,
                subjects_by_uuid,
                subjects_by_name,
            )
            if subject_id is None:
                result.import_log.append(
                    f"Lesson '{l_data.title}': subject "
                    f"'{l_data.subject_name}' unresolved — left unlinked"
                )

        created_by = None
        if l_data.created_by_external_id or l_data.created_by_email:
            created_by = _resolve(
                l_data.created_by_external_id,
                l_data.created_by_email,
                users_by_uuid,
                users_by_email,
            )
            if created_by is None:
                result.import_log.append(
                    f"Lesson '{l_data.title}': creator "
                    f"{l_data.created_by_email} unresolved — left unlinked"
                )

        student_ids = []
        for ref in l_data.students:
            student_id = _resolve(
                ref.student_external_id,
                ref.student_email,
                users_by_uuid,
                users_by_email,
            )
            if student_id is None:
                result.warnings.append(
                    f"Lesson '{l_data.title}': student {ref.student_email} "
                    "not found — dropped from lesson"
                )
                continue
            student_ids.append(student_id)

        if not dry_run:
            from app.enums import LessonStatus

            new_lesson = Lesson(
                external_id=l_data.external_id,
                date=l_data.date,
                title=l_data.title,
                objective=l_data.objective,
                duration_minutes=l_data.duration_minutes,
                notes=l_data.notes,
                position=l_data.position,
                status=LessonStatus(l_data.status),
                subject_id=subject_id,
                created_by=created_by,
                created_at=l_data.created_at,
                updated_at=l_data.updated_at,
            )
            if student_ids:
                new_lesson.students = (
                    db.query(User).filter(User.id.in_(student_ids)).all()
                )

            links = []
            for link_data in l_data.templates:
                template_id = _resolve(
                    link_data.template_external_id,
                    link_data.template_name,
                    templates_by_uuid,
                    templates_by_name,
                )
                if template_id is None:
                    result.import_log.append(
                        f"Lesson '{l_data.title}': template "
                        f"'{link_data.template_name}' unresolved — link kept "
                        "with no template"
                    )
                links.append(
                    LessonTemplate(
                        template_id=template_id,
                        custom_due_date=link_data.custom_due_date,
                        custom_max_points=link_data.custom_max_points,
                        custom_instructions=link_data.custom_instructions,
                    )
                )
            new_lesson.templates = links
            new_lesson.materials = [
                LessonMaterial(
                    label=m.label, is_gathered=m.is_gathered, position=m.position
                )
                for m in l_data.materials
            ]
            new_lesson.resources = [
                LessonResource(label=r.label, url=r.url, position=r.position)
                for r in l_data.resources
            ]

            db.add(new_lesson)
            db.flush()
            by_uuid[l_data.external_id] = new_lesson.id
            result.import_log.append(f"Created lesson: {l_data.title}")
        imported += 1

    result.id_mappings["lessons_by_uuid"] = by_uuid
    result.imported_counts["lessons"] = imported


def _import_paperless_maps(
    db: Session, tag_maps_data, doctype_maps_data, result, dry_run
):
    """Import Paperless tag→subject and doctype→kind mappings.

    Upserts by paperless tag/doctype id so a merge refreshes mappings without
    duplicating rows; a wipe-and-restore recreates them outright. Unresolvable
    subjects degrade to an unmapped tag (SET NULL contract).
    """
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    imported = 0

    existing_tags = {m.paperless_tag_id: m for m in db.query(PaperlessTagMap).all()}
    for m_data in tag_maps_data:
        subject_id = None
        if m_data.subject_external_id or m_data.subject_name:
            subject_id = _resolve(
                m_data.subject_external_id,
                m_data.subject_name or "",
                subjects_by_uuid,
                subjects_by_name,
            )
            if subject_id is None:
                result.import_log.append(
                    f"Paperless tag '{m_data.paperless_tag_name}': subject "
                    f"'{m_data.subject_name}' unresolved — left unmapped"
                )
        if not dry_run:
            row = existing_tags.get(m_data.paperless_tag_id)
            if row is None:
                db.add(
                    PaperlessTagMap(
                        paperless_tag_id=m_data.paperless_tag_id,
                        paperless_tag_name=m_data.paperless_tag_name,
                        subject_id=subject_id,
                        auto_matched=m_data.auto_matched,
                    )
                )
            else:
                row.paperless_tag_name = m_data.paperless_tag_name
                row.subject_id = subject_id
                row.auto_matched = m_data.auto_matched
        imported += 1

    existing_doctypes = {
        m.paperless_doctype_id: m for m in db.query(PaperlessDoctypeMap).all()
    }
    for m_data in doctype_maps_data:
        if not dry_run:
            row = existing_doctypes.get(m_data.paperless_doctype_id)
            if row is None:
                db.add(
                    PaperlessDoctypeMap(
                        paperless_doctype_id=m_data.paperless_doctype_id,
                        paperless_doctype_name=m_data.paperless_doctype_name,
                        material_kind=m_data.material_kind,
                    )
                )
            else:
                row.paperless_doctype_name = m_data.paperless_doctype_name
                row.material_kind = m_data.material_kind
        imported += 1

    if not dry_run:
        db.flush()
    result.imported_counts["paperless_maps"] = imported


def _import_paperless_documents(db: Session, documents_data, result, dry_run):
    """Import cached Paperless document metadata.

    Dedup on paperless_id (the stable per-server identity). Existing rows are
    kept as-is (merge semantics); either way the row's DB id is recorded in
    id_mappings["paperless_docs_by_pid"] for the attachment importers.
    """
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    # str keys: id_mappings serializes as Dict[str, Dict[str, int]].
    by_pid: Dict[str, int] = {}
    imported = skipped = 0

    existing = {d.paperless_id: d for d in db.query(PaperlessDocument).all()}
    for d_data in documents_data:
        row = existing.get(d_data.paperless_id)
        if row is not None:
            by_pid[str(d_data.paperless_id)] = row.id
            skipped += 1
            result.import_log.append(f"Skipped existing Paperless doc: {d_data.title}")
            continue

        subject_id = None
        if d_data.subject_external_id or d_data.subject_name:
            subject_id = _resolve(
                d_data.subject_external_id,
                d_data.subject_name or "",
                subjects_by_uuid,
                subjects_by_name,
            )

        if not dry_run:
            new_doc = PaperlessDocument(
                external_id=d_data.external_id,
                paperless_id=d_data.paperless_id,
                asn=d_data.asn,
                title=d_data.title,
                correspondent=d_data.correspondent,
                paperless_doctype_id=d_data.paperless_doctype_id,
                material_kind=d_data.material_kind,
                subject_id=subject_id,
                tag_ids=list(d_data.tag_ids or []),
                page_count=d_data.page_count,
                paperless_created=d_data.paperless_created,
                paperless_added=d_data.paperless_added,
                paperless_modified=d_data.paperless_modified,
                keywords=d_data.keywords,
                present=d_data.present,
                synced_at=d_data.synced_at,
            )
            db.add(new_doc)
            db.flush()
            by_pid[str(d_data.paperless_id)] = new_doc.id
        else:
            # Placeholder id so dry-run attachment resolution mirrors a real
            # import (no DB access happens with it under dry_run).
            by_pid[str(d_data.paperless_id)] = -1
        imported += 1

    result.id_mappings["paperless_docs_by_pid"] = by_pid
    result.imported_counts["paperless_documents"] = imported


def _snapshot_kwargs(link_data, subjects_by_uuid, subjects_by_name):
    """Snapshot column values shared by the three attachment importers."""
    subject_id = None
    if link_data.subject_external_id or link_data.subject_name:
        subject_id = _resolve(
            link_data.subject_external_id,
            link_data.subject_name or "",
            subjects_by_uuid,
            subjects_by_name,
        )
    return {
        "title": link_data.title,
        "asn": link_data.asn,
        "material_kind": link_data.material_kind,
        "subject_id": subject_id,
        "page_count": link_data.page_count,
        "correspondent": link_data.correspondent,
        "created_at": link_data.created_at,
    }


def _import_lesson_paperless_materials(db: Session, links_data, result, dry_run):
    """Re-link Paperless documents to lessons (both resolved from earlier maps)."""
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    lessons_by_uuid = result.id_mappings.get("lessons_by_uuid", {})
    docs_by_pid = result.id_mappings.get("paperless_docs_by_pid", {})
    imported = skipped = 0

    for link_data in links_data:
        lesson_id = lessons_by_uuid.get(link_data.lesson_external_id)
        document_id = docs_by_pid.get(str(link_data.document_paperless_id))
        if lesson_id is None or document_id is None:
            result.import_log.append(
                f"Skipped lesson attachment '{link_data.title}' (unresolved "
                f"{'lesson' if lesson_id is None else 'document'})"
            )
            continue
        if not dry_run:
            existing = (
                db.query(LessonPaperlessMaterial)
                .filter(
                    LessonPaperlessMaterial.lesson_id == lesson_id,
                    LessonPaperlessMaterial.document_id == document_id,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue
            db.add(
                LessonPaperlessMaterial(
                    lesson_id=lesson_id,
                    document_id=document_id,
                    **_snapshot_kwargs(link_data, subjects_by_uuid, subjects_by_name),
                )
            )
        imported += 1

    result.imported_counts["lesson_paperless_materials"] = imported


def _import_template_paperless_materials(db: Session, links_data, result, dry_run):
    """Re-link Paperless documents to assignment templates."""
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    templates_by_uuid = result.id_mappings.get("templates_by_uuid", {})
    templates_by_name = result.id_mappings.get("templates_by_name", {})
    docs_by_pid = result.id_mappings.get("paperless_docs_by_pid", {})
    imported = skipped = 0

    for link_data in links_data:
        template_id = _resolve(
            link_data.template_external_id,
            link_data.template_name,
            templates_by_uuid,
            templates_by_name,
        )
        document_id = docs_by_pid.get(str(link_data.document_paperless_id))
        if template_id is None or document_id is None:
            result.import_log.append(
                f"Skipped template attachment '{link_data.title}' (unresolved "
                f"{'template' if template_id is None else 'document'})"
            )
            continue
        if not dry_run:
            existing = (
                db.query(TemplatePaperlessMaterial)
                .filter(
                    TemplatePaperlessMaterial.template_id == template_id,
                    TemplatePaperlessMaterial.document_id == document_id,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue
            db.add(
                TemplatePaperlessMaterial(
                    template_id=template_id,
                    document_id=document_id,
                    **_snapshot_kwargs(link_data, subjects_by_uuid, subjects_by_name),
                )
            )
        imported += 1

    result.imported_counts["template_paperless_materials"] = imported


def _import_student_assignment_paperless_materials(
    db: Session, links_data, result, dry_run
):
    """Re-link one-off Paperless documents to assignment instances.

    The owning StudentAssignment is found by the same (student, template,
    due_date) triple the assignment importer dedupes on; ambiguity resolves to
    the first match, mirroring that importer's semantics.
    """
    subjects_by_uuid = result.id_mappings.get("subjects_by_uuid", {})
    subjects_by_name = result.id_mappings.get("subjects_by_name", {})
    users_by_uuid = result.id_mappings.get("users_by_uuid", {})
    users_by_email = result.id_mappings.get("users_by_email", {})
    templates_by_uuid = result.id_mappings.get("templates_by_uuid", {})
    templates_by_name = result.id_mappings.get("templates_by_name", {})
    docs_by_pid = result.id_mappings.get("paperless_docs_by_pid", {})
    imported = skipped = 0

    for link_data in links_data:
        student_id = _resolve(
            link_data.student_external_id,
            link_data.student_email,
            users_by_uuid,
            users_by_email,
        )
        template_id = _resolve(
            link_data.template_external_id,
            link_data.assignment_template_name,
            templates_by_uuid,
            templates_by_name,
        )
        document_id = docs_by_pid.get(str(link_data.document_paperless_id))
        if student_id is None or template_id is None or document_id is None:
            result.import_log.append(
                f"Skipped assignment attachment '{link_data.title}' "
                "(unresolved student/template/document)"
            )
            continue

        assignment = (
            db.query(StudentAssignment)
            .filter(
                StudentAssignment.student_id == student_id,
                StudentAssignment.template_id == template_id,
                StudentAssignment.due_date == link_data.due_date,
            )
            .first()
        )
        if assignment is None:
            result.import_log.append(
                f"Skipped assignment attachment '{link_data.title}' "
                f"({link_data.student_email}/{link_data.assignment_template_name}: "
                "no matching assignment)"
            )
            continue

        if not dry_run:
            existing = (
                db.query(StudentAssignmentPaperlessMaterial)
                .filter(
                    StudentAssignmentPaperlessMaterial.student_assignment_id
                    == assignment.id,
                    StudentAssignmentPaperlessMaterial.document_id == document_id,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue
            db.add(
                StudentAssignmentPaperlessMaterial(
                    student_assignment_id=assignment.id,
                    document_id=document_id,
                    **_snapshot_kwargs(link_data, subjects_by_uuid, subjects_by_name),
                )
            )
        imported += 1

    result.imported_counts["student_assignment_paperless_materials"] = imported
    result.skipped_counts["lessons"] = skipped
