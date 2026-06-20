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

"""Data export utilities for backup operations."""
from typing import List

from sqlalchemy.orm import Session

from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry
from app.models.points import PointTransaction, StudentPoints
from app.models.subject import Subject
from app.models.term import GradeHistory, StudentTermGrade, Term, TermSubject
from app.models.user import User
from app.schemas.backup import (
    AssignmentTemplateBackup,
    AttendanceRecordBackup,
    GradeHistoryBackup,
    JournalEntryBackup,
    PointTransactionBackup,
    StudentAssignmentBackup,
    StudentPointsBackup,
    StudentTermGradeBackup,
    SubjectBackup,
    SystemSettingsBackup,
    TermBackup,
    TermSubjectBackup,
    UserBackup,
)


def export_users(db: Session) -> List[UserBackup]:
    """Export all users (excluding password hashes for security)."""
    users_data = []
    users = db.query(User).all()
    for user in users:
        users_data.append(UserBackup(
            external_id=user.external_id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role.value,
            is_active=user.is_active,
            parent_id=user.parent_id,
            date_of_birth=user.date_of_birth,
            grade_level=user.grade_level,
            created_at=user.created_at,
            updated_at=user.updated_at
        ))
    return users_data


def export_subjects(db: Session) -> List[SubjectBackup]:
    """Export all subjects."""
    subjects_data = []
    subjects = db.query(Subject).all()
    for subject in subjects:
        subjects_data.append(SubjectBackup(
            external_id=subject.external_id,
            name=subject.name,
            description=subject.description,
            color=subject.color,
            icon=subject.icon,
        ))
    return subjects_data


def export_terms(db: Session) -> List[TermBackup]:
    """Export all terms."""
    terms_data = []
    terms = db.query(Term).all()
    for term in terms:
        terms_data.append(TermBackup(
            external_id=term.external_id,
            name=term.name,
            type=term.term_type.value,
            academic_year=term.academic_year,
            start_date=term.start_date,
            end_date=term.end_date,
            is_current=term.is_current,
            created_at=term.created_at,
            updated_at=term.updated_at
        ))
    return terms_data


def export_assignment_templates(db: Session) -> List[AssignmentTemplateBackup]:
    """Export all assignment templates."""
    templates_data = []
    templates = db.query(AssignmentTemplate).all()
    for template in templates:
        # Get creator email
        creator = db.query(User).filter(User.id == template.created_by).first()
        creator_email = creator.email if creator else "unknown@system.local"
        
        templates_data.append(AssignmentTemplateBackup(
            external_id=template.external_id,
            name=template.name,
            description=template.description,
            instructions=template.instructions,
            assignment_type=template.assignment_type,
            subject_external_id=template.subject.external_id if template.subject else None,
            subject_name=template.subject.name if template.subject else "Unknown",
            icon=template.icon,
            max_points=template.max_points,
            estimated_duration_minutes=template.estimated_duration_minutes,
            prerequisites=template.prerequisites,
            materials_needed=template.materials_needed,
            is_exportable=template.is_exportable,
            created_by_email=creator_email,
            created_at=template.created_at,
            updated_at=template.updated_at
        ))
    return templates_data


def export_term_subjects(db: Session) -> List[TermSubjectBackup]:
    """Export all term subjects."""
    term_subjects_data = []
    term_subjects = db.query(TermSubject).all()
    for ts in term_subjects:
        term_subjects_data.append(TermSubjectBackup(
            term_external_id=ts.term.external_id if ts.term else None,
            term_name=ts.term.name if ts.term else "Unknown",
            subject_external_id=ts.subject.external_id if ts.subject else None,
            subject_name=ts.subject.name if ts.subject else "Unknown",
            weight=getattr(ts, 'weight', None),
        ))
    return term_subjects_data


def export_student_assignments(db: Session) -> List[StudentAssignmentBackup]:
    """Export all student assignments."""
    student_assignments_data = []
    student_assignments = db.query(StudentAssignment).all()
    for sa in student_assignments:
        student_assignments_data.append(StudentAssignmentBackup(
            student_external_id=sa.student.external_id if sa.student else None,
            student_email=sa.student.email if sa.student else "Unknown",
            template_external_id=sa.template.external_id if sa.template else None,
            assignment_template_name=sa.template.name if sa.template else "Unknown",
            due_date=sa.due_date,
            extended_due_date=sa.extended_due_date,
            status=sa.status.value,
            points_earned=sa.points_earned,
            letter_grade=sa.letter_grade,
            teacher_feedback=sa.teacher_feedback,
            student_notes=sa.student_notes,
            submission_notes=sa.submission_notes,
            custom_instructions=sa.custom_instructions,
            custom_max_points=sa.custom_max_points,
            started_at=getattr(sa, 'started_date', None),
            completed_at=getattr(sa, 'completed_date', None),
            submitted_at=getattr(sa, 'submitted_date', None),
            created_at=sa.created_at,
            updated_at=sa.updated_at
        ))
    return student_assignments_data


def export_student_term_grades(db: Session) -> List[StudentTermGradeBackup]:
    """Export all student term grades."""
    term_grades_data = []
    term_grades = db.query(StudentTermGrade).all()
    for grade in term_grades:
        ts = grade.term_subject
        term = ts.term if ts else None
        subject = ts.subject if ts else None
        term_grades_data.append(StudentTermGradeBackup(
            student_external_id=grade.student.external_id if grade.student else None,
            student_email=grade.student.email if grade.student else "Unknown",
            term_external_id=term.external_id if term else None,
            term_name=term.name if term else "Unknown",
            subject_external_id=subject.external_id if subject else None,
            subject_name=subject.name if subject else "Unknown",
            current_points_earned=grade.current_points_earned or 0.0,
            current_points_possible=grade.current_points_possible or 0.0,
            current_percentage=grade.current_percentage,
            current_letter_grade=grade.current_letter_grade,
            final_points_earned=grade.final_points_earned,
            final_points_possible=grade.final_points_possible,
            final_percentage=grade.final_percentage,
            final_letter_grade=grade.final_letter_grade,
            is_finalized=grade.is_finalized or False,
            assignments_completed=grade.assignments_completed or 0,
            assignments_total=grade.assignments_total or 0,
            progress_notes=grade.progress_notes,
            created_at=grade.created_at,
            updated_at=grade.updated_at
        ))
    return term_grades_data


def export_grade_history(db: Session) -> List[GradeHistoryBackup]:
    """Export all grade history audit entries."""
    grade_history_data = []
    grade_history = db.query(GradeHistory).all()
    for history in grade_history:
        stg = history.student_term_grade
        ts = stg.term_subject if stg else None
        term = ts.term if ts else None
        subject = ts.subject if ts else None
        student = stg.student if stg else None
        grade_history_data.append(GradeHistoryBackup(
            student_email=student.email if student else "Unknown",
            term_name=term.name if term else "Unknown",
            subject_name=subject.name if subject else "Unknown",
            field_name=history.field_name,
            old_value=history.old_value,
            new_value=history.new_value,
            change_reason=history.change_reason,
            changed_at=history.changed_at
        ))
    return grade_history_data


def export_attendance_records(db: Session) -> List[AttendanceRecordBackup]:
    """Export all attendance records."""
    attendance_data = []
    attendance = db.query(AttendanceRecord).all()
    for record in attendance:
        attendance_data.append(AttendanceRecordBackup(
            student_external_id=record.student.external_id if record.student else None,
            student_email=record.student.email if record.student else "Unknown",
            date=record.date,
            status=record.status.value,
            notes=record.notes,
            created_at=record.created_at,
            updated_at=record.updated_at
        ))
    return attendance_data


def export_journal_entries(db: Session) -> List[JournalEntryBackup]:
    """Export all journal entries."""
    journal_data = []
    journal_entries = db.query(JournalEntry).all()
    for entry in journal_entries:
        journal_data.append(JournalEntryBackup(
            user_external_id=entry.author.external_id if entry.author else None,
            user_email=entry.author.email if entry.author else "Unknown",
            title=entry.title,
            content=entry.content,
            date=entry.entry_date.date(),
            is_private=False,  # Default value since field doesn't exist in model
            created_at=entry.created_at,
            updated_at=entry.updated_at
        ))
    return journal_data


def export_system_settings(db: Session) -> List[SystemSettingsBackup]:
    """Export all system settings."""
    from app.models.points import SystemSettings
    settings_data = []
    for setting in db.query(SystemSettings).all():
        settings_data.append(SystemSettingsBackup(
            setting_key=setting.setting_key,
            setting_value=setting.setting_value,
            setting_type=setting.setting_type,
            description=setting.description,
            is_active=setting.is_active,
        ))
    return settings_data


def export_student_points(db: Session) -> List[StudentPointsBackup]:
    """Export all student point balances."""
    points_data = []
    for sp in db.query(StudentPoints).all():
        points_data.append(StudentPointsBackup(
            student_external_id=sp.student.external_id if sp.student else None,
            student_email=sp.student.email if sp.student else "Unknown",
            current_balance=sp.current_balance,
            total_earned=sp.total_earned,
            total_spent=sp.total_spent,
            created_at=sp.created_at,
            updated_at=sp.updated_at
        ))
    return points_data


def export_point_transactions(db: Session) -> List[PointTransactionBackup]:
    """Export all point transactions in chronological order."""
    transactions_data = []
    for tx in db.query(PointTransaction).order_by(PointTransaction.created_at).all():
        transactions_data.append(PointTransactionBackup(
            student_external_id=tx.student.external_id if tx.student else None,
            student_email=tx.student.email if tx.student else "Unknown",
            amount=tx.amount,
            transaction_type=tx.transaction_type,
            source_description=tx.source_description,
            notes=tx.notes,
            created_at=tx.created_at
        ))
    return transactions_data