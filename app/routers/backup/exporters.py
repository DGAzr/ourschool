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
from app.models.lesson import Lesson, LessonAssignment, Subject
from app.models.term import GradeHistory, StudentTermGrade, Term, TermSubject
from app.models.user import User
from app.schemas.backup import (
    AssignmentTemplateBackup,
    AttendanceRecordBackup,
    GradeHistoryBackup,
    JournalEntryBackup,
    LessonAssignmentBackup,
    LessonBackup,
    StudentAssignmentBackup,
    StudentTermGradeBackup,
    SubjectBackup,
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
            name=subject.name,
            description=subject.description,
            color=subject.color
        ))
    return subjects_data


def export_terms(db: Session) -> List[TermBackup]:
    """Export all terms."""
    terms_data = []
    terms = db.query(Term).all()
    for term in terms:
        terms_data.append(TermBackup(
            name=term.name,
            type=term.term_type.value,
            start_date=term.start_date,
            end_date=term.end_date,
            is_current=term.is_current,
            created_at=term.created_at,
            updated_at=term.updated_at
        ))
    return terms_data


def export_lessons(db: Session) -> List[LessonBackup]:
    """Export all lessons."""
    lessons_data = []
    lessons = db.query(Lesson).all()
    for lesson in lessons:
        lessons_data.append(LessonBackup(
            title=lesson.title,
            description=lesson.description,
            scheduled_date=lesson.scheduled_date,
            start_time=lesson.start_time,
            end_time=lesson.end_time,
            estimated_duration_minutes=lesson.estimated_duration_minutes,
            materials_needed=lesson.materials_needed,
            objectives=lesson.objectives,
            prerequisites=lesson.prerequisites,
            resources=lesson.resources,
            lesson_order=lesson.lesson_order,
            subject_names=lesson.subject_names,
            created_at=lesson.created_at,
            updated_at=lesson.updated_at
        ))
    return lessons_data


def export_assignment_templates(db: Session) -> List[AssignmentTemplateBackup]:
    """Export all assignment templates."""
    templates_data = []
    templates = db.query(AssignmentTemplate).all()
    for template in templates:
        # Get creator email
        creator = db.query(User).filter(User.id == template.created_by).first()
        creator_email = creator.email if creator else "unknown@system.local"
        
        templates_data.append(AssignmentTemplateBackup(
            name=template.name,
            description=template.description,
            instructions=template.instructions,
            assignment_type=template.assignment_type.value,
            subject_name=template.subject.name if template.subject else "Unknown",
            lesson_id=template.lesson_id,
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


def export_lesson_assignments(db: Session) -> List[LessonAssignmentBackup]:
    """Export all lesson assignments."""
    lesson_assignments_data = []
    lesson_assignments = db.query(LessonAssignment).all()
    for la in lesson_assignments:
        lesson_assignments_data.append(LessonAssignmentBackup(
            lesson_title=la.lesson.title,
            assignment_template_name=la.assignment_template.name,
            order_in_lesson=la.order_in_lesson,
            planned_duration_minutes=la.planned_duration_minutes,
            custom_instructions=la.custom_instructions,
            is_required=la.is_required,
            custom_max_points=la.custom_max_points,
            created_at=la.created_at
        ))
    return lesson_assignments_data


def export_term_subjects(db: Session) -> List[TermSubjectBackup]:
    """Export all term subjects."""
    term_subjects_data = []
    term_subjects = db.query(TermSubject).all()
    for ts in term_subjects:
        term_subjects_data.append(TermSubjectBackup(
            term_name=ts.term.name,
            subject_name=ts.subject.name,
            credits=ts.credits,
            created_at=ts.created_at
        ))
    return term_subjects_data


def export_student_assignments(db: Session) -> List[StudentAssignmentBackup]:
    """Export all student assignments."""
    student_assignments_data = []
    student_assignments = db.query(StudentAssignment).all()
    for sa in student_assignments:
        student_assignments_data.append(StudentAssignmentBackup(
            student_email=sa.student.email if sa.student else "Unknown",
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
        term_grades_data.append(StudentTermGradeBackup(
            student_email=grade.student.email if grade.student else "Unknown",
            term_name=grade.term.name if grade.term else "Unknown", 
            subject_name=grade.subject.name if grade.subject else "Unknown",
            letter_grade=grade.letter_grade,
            percentage_grade=grade.percentage_grade,
            credits_earned=grade.credits_earned,
            gpa_points=grade.gpa_points,
            is_final=grade.is_final,
            notes=grade.notes,
            created_at=grade.created_at,
            updated_at=grade.updated_at
        ))
    return term_grades_data


def export_grade_history(db: Session) -> List[GradeHistoryBackup]:
    """Export all grade history."""
    grade_history_data = []
    grade_history = db.query(GradeHistory).all()
    for history in grade_history:
        grade_history_data.append(GradeHistoryBackup(
            student_email=history.student.email if history.student else "Unknown",
            term_name=history.term.name if history.term else "Unknown",
            subject_name=history.subject.name if history.subject else "Unknown",
            old_letter_grade=history.old_letter_grade,
            new_letter_grade=history.new_letter_grade,
            old_percentage_grade=history.old_percentage_grade,
            new_percentage_grade=history.new_percentage_grade,
            change_reason=history.change_reason,
            changed_by=history.changed_by,
            changed_at=history.changed_at
        ))
    return grade_history_data


def export_attendance_records(db: Session) -> List[AttendanceRecordBackup]:
    """Export all attendance records."""
    attendance_data = []
    attendance = db.query(AttendanceRecord).all()
    for record in attendance:
        attendance_data.append(AttendanceRecordBackup(
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
            user_email=entry.author.email if entry.author else "Unknown",
            title=entry.title,
            content=entry.content,
            date=entry.entry_date.date(),
            is_private=False,  # Default value since field doesn't exist in model
            created_at=entry.created_at,
            updated_at=entry.updated_at
        ))
    return journal_data