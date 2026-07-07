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


"""CRUD operations for student/admin overview reports and academic years."""

from datetime import date, timedelta
from typing import List, Optional

from app.models.assignment import (
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry
from app.models.subject import Subject
from app.models.term import Term
from app.models.user import User, UserRole
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.crud import settings as crud_settings
from app.schemas import reports as schemas
from app.utils.attendance import calculate_attendance_rate
from app.utils.grading import (
    calculate_letter_grade,
    compute_weighted_grade,
    effective_due_date,
    term_membership_filter,
)
from app.utils.performance import track_query_performance

from app.crud.reports.grades import get_student_subject_performance
from app.crud.reports.shared import (
    _build_weekly_series,
    _compute_trend_int,
    _glance_status,
    _grade_item,
    _is_graded,
    _journal_summary,
    _letter_grade,
)


def get_student_report(db: Session, student_id: int):
    """Get a report for a single student."""
    assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.student_id == student_id)
        .options(joinedload(StudentAssignment.template))
        .all()
    )

    type_weights = crud_settings.get_assignment_type_weights(db)

    total_assignments = len(assignments)
    completed_assignments = sum(
        1 for a in assignments if a.status == AssignmentStatus.GRADED
    )
    in_progress_assignments = sum(
        1 for a in assignments if a.status == AssignmentStatus.IN_PROGRESS
    )
    pending_grades = sum(
        1 for a in assignments if a.status == AssignmentStatus.SUBMITTED
    )

    graded_assignments = [a for a in assignments if _is_graded(a)]
    _, _, average_grade = compute_weighted_grade(
        (_grade_item(a) for a in graded_assignments), type_weights
    )

    # Current term grade (assignments whose effective due date falls in the term)
    active_term = db.query(Term).filter(Term.is_active).first()
    current_term_grade = 0.0
    if active_term:
        term_assignments = [
            a
            for a in graded_assignments
            if active_term.start_date <= effective_due_date(a) <= active_term.end_date
        ]
        _, _, current_term_grade = compute_weighted_grade(
            (_grade_item(a) for a in term_assignments), type_weights
        )

    grade_series = _build_weekly_series(graded_assignments, type_weights, active_term)
    trend = _compute_trend_int(grade_series)
    journal_str = _journal_summary(db, student_id, active_term)

    return schemas.StudentReport(
        total_assignments=total_assignments,
        completed_assignments=completed_assignments,
        in_progress_assignments=in_progress_assignments,
        pending_grades=pending_grades,
        average_grade=round(average_grade, 2),
        current_term_grade=round(current_term_grade, 2),
        grade_series=grade_series,
        trend=trend,
        journal_summary=journal_str,
    )


@track_query_performance("get_admin_report")
def get_admin_report(db: Session):
    """Get a report for an admin."""
    total_students = db.query(User).filter(User.role == UserRole.STUDENT).count()

    active_assignments = (
        db.query(StudentAssignment)
        .filter(
            StudentAssignment.status.in_(
                [AssignmentStatus.IN_PROGRESS, AssignmentStatus.SUBMITTED]
            )
        )
        .count()
    )

    pending_grades = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.status == AssignmentStatus.SUBMITTED)
        .count()
    )

    total_assignments = db.query(StudentAssignment).count()
    completed_assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.status == AssignmentStatus.GRADED)
        .count()
    )

    # Overall average grade = mean of each student's points-weighted grade.
    # Students with no graded work are excluded so they don't drag the mean to 0.
    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)
    students = (
        db.query(User)
        .filter(User.role == UserRole.STUDENT)
        .options(
            joinedload(User.assigned_assignments).joinedload(StudentAssignment.template)
        )
        .all()
    )

    student_grades = []
    for student in students:
        graded = [a for a in student.assigned_assignments if _is_graded(a)]
        if not graded:
            continue
        _, possible, percentage = compute_weighted_grade(
            (_grade_item(a) for a in graded), type_weights
        )
        if possible > 0:
            student_grades.append(percentage)

    average_grade = sum(student_grades) / len(student_grades) if student_grades else 0.0

    # ── Rich overview fields ───────────────────────────────────────────────────

    active_term = db.query(Term).filter(Term.is_active).first()
    prior_term = None
    if active_term:
        prior_term = (
            db.query(Term)
            .filter(Term.end_date < active_term.start_date)
            .order_by(Term.end_date.desc())
            .first()
        )

    # Class-average weekly series (all students' graded work in the active term)
    all_graded_in_term: list = []
    if active_term:
        all_graded_in_term = (
            db.query(StudentAssignment)
            .join(
                AssignmentTemplate,
                StudentAssignment.template_id == AssignmentTemplate.id,
            )
            .filter(
                StudentAssignment.is_graded == True,  # noqa: E712
                StudentAssignment.points_earned.isnot(None),
                term_membership_filter(active_term),
            )
            .options(joinedload(StudentAssignment.template))
            .all()
        )
    class_average_series = _build_weekly_series(
        all_graded_in_term, type_weights, active_term
    )

    # Prior-term class average for delta
    prior_avg = 0.0
    if prior_term:
        prior_graded = (
            db.query(StudentAssignment)
            .join(
                AssignmentTemplate,
                StudentAssignment.template_id == AssignmentTemplate.id,
            )
            .filter(
                StudentAssignment.is_graded == True,  # noqa: E712
                StudentAssignment.points_earned.isnot(None),
                term_membership_filter(prior_term),
            )
            .options(joinedload(StudentAssignment.template))
            .all()
        )
        if prior_graded:
            _, _, prior_avg = compute_weighted_grade(
                (_grade_item(a) for a in prior_graded), type_weights
            )

    def _fmt_delta(current: float, prior: float, unit: str = "pts") -> tuple:
        diff = round(current - prior)
        if diff > 0:
            return f"▲ {diff} {unit} vs last term", True
        if diff < 0:
            return f"▼ {abs(diff)} {unit} vs last term", False
        return "— same as last term", True

    # Completion rate KPI
    current_completion = (
        (completed_assignments / total_assignments * 100)
        if total_assignments > 0
        else 0.0
    )
    prior_completion = 0.0
    if prior_term and prior_graded:
        # Approximate: completed in prior term / total in prior term
        prior_total_in_term = len(prior_graded)  # graded = completed
        prior_all_in_term = (
            db.query(StudentAssignment)
            .join(
                AssignmentTemplate,
                StudentAssignment.template_id == AssignmentTemplate.id,
            )
            .filter(term_membership_filter(prior_term))
            .count()
        )
        prior_completion = (
            prior_total_in_term / prior_all_in_term * 100
            if prior_all_in_term > 0
            else 0.0
        )

    # Attendance KPI (current term, all students)
    current_att_rate = 0.0
    prior_att_rate = 0.0
    all_student_ids = [s.id for s in students]
    if active_term and all_student_ids:
        att_records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id.in_(all_student_ids),
                AttendanceRecord.date >= active_term.start_date,
                AttendanceRecord.date <= active_term.end_date,
            )
            .all()
        )
        if att_records:
            total_present = sum(1 for r in att_records if r.status.value == "present")
            current_att_rate = total_present / len(att_records) * 100

    if prior_term and all_student_ids:
        prior_att_records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id.in_(all_student_ids),
                AttendanceRecord.date >= prior_term.start_date,
                AttendanceRecord.date <= prior_term.end_date,
            )
            .all()
        )
        if prior_att_records:
            total_present_prior = sum(
                1 for r in prior_att_records if r.status.value == "present"
            )
            prior_att_rate = total_present_prior / len(prior_att_records) * 100

    # Journaling KPI (entries this week across all students)
    week_start = date.today() - timedelta(days=date.today().weekday())
    journal_count_week = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.student_id.in_(all_student_ids),
            JournalEntry.entry_date >= week_start,
        )
        .count()
        if all_student_ids
        else 0
    )
    prior_week_start = week_start - timedelta(days=7)
    journal_count_prior = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.student_id.in_(all_student_ids),
            JournalEntry.entry_date >= prior_week_start,
            JournalEntry.entry_date < week_start,
        )
        .count()
        if all_student_ids
        else 0
    )

    avg_delta_text, avg_delta_pos = _fmt_delta(average_grade, prior_avg)
    comp_delta_text, comp_delta_pos = _fmt_delta(current_completion, prior_completion)
    att_delta_text, att_delta_pos = _fmt_delta(current_att_rate, prior_att_rate)
    jrnl_diff = journal_count_week - journal_count_prior
    jrnl_delta_text = (
        f"▲ {jrnl_diff} vs last week"
        if jrnl_diff > 0
        else (
            f"▼ {abs(jrnl_diff)} vs last week"
            if jrnl_diff < 0
            else "— same as last week"
        )
    )

    # Build KPI sparklines from class_average_series (resampled for visual variety)
    def _kpi_series(values: list, count: int = 8) -> List[float]:
        """Return up to `count` evenly-spaced items from `values`."""
        if not values:
            return []
        if len(values) <= count:
            return values
        step = (len(values) - 1) / (count - 1)
        return [values[int(round(i * step))] for i in range(count)]

    kpis = [
        schemas.MetricTrend(
            label="Class average",
            value=f"{round(average_grade)}%",
            series=_kpi_series(class_average_series),
            delta=avg_delta_text,
            delta_positive=avg_delta_pos,
        ),
        schemas.MetricTrend(
            label="Completion",
            value=f"{round(current_completion)}%",
            series=_kpi_series(class_average_series),
            delta=comp_delta_text,
            delta_positive=comp_delta_pos,
        ),
        schemas.MetricTrend(
            label="Attendance",
            value=f"{round(current_att_rate)}%",
            series=[],
            delta=att_delta_text,
            delta_positive=att_delta_pos,
        ),
        schemas.MetricTrend(
            label="Journaling",
            value=str(journal_count_week),
            series=[],
            delta=jrnl_delta_text + " (entries this week)",
            delta_positive=jrnl_diff >= 0,
        ),
    ]

    # Subject averages (class-wide average per subject, active term)
    subjects_all = db.query(Subject).order_by(Subject.name).all()
    subject_averages: List[schemas.SubjectAverage] = []
    for subj in subjects_all:
        subj_graded = (
            db.query(StudentAssignment)
            .join(
                AssignmentTemplate,
                StudentAssignment.template_id == AssignmentTemplate.id,
            )
            .filter(
                AssignmentTemplate.subject_id == subj.id,
                StudentAssignment.is_graded == True,  # noqa: E712
                StudentAssignment.points_earned.isnot(None),
            )
            .options(joinedload(StudentAssignment.template))
            .all()
        )
        if not subj_graded:
            continue
        if active_term:
            term_subj_graded = [
                a
                for a in subj_graded
                if active_term.start_date
                <= effective_due_date(a)
                <= active_term.end_date
            ]
        else:
            term_subj_graded = subj_graded
        if not term_subj_graded:
            continue
        _, _, pct = compute_weighted_grade(
            (_grade_item(a) for a in term_subj_graded), type_weights
        )
        subject_averages.append(
            schemas.SubjectAverage(
                subject_id=subj.id,
                subject_name=subj.name,
                subject_color=subj.color,
                percentage=round(pct, 1),
                letter_grade=_letter_grade(pct, grade_scale),
                flagged=pct < 80,
            )
        )

    # Students-at-a-glance rows (reuse student grades already computed above)
    students_glance: List[schemas.StudentGlanceRow] = []
    for student in students:
        s_graded = [a for a in student.assigned_assignments if _is_graded(a)]
        if not s_graded:
            s_grade = 0.0
        else:
            _, _, s_grade = compute_weighted_grade(
                (_grade_item(a) for a in s_graded), type_weights
            )

        s_total = len(student.assigned_assignments)
        s_completed = sum(
            1
            for a in student.assigned_assignments
            if a.status == AssignmentStatus.GRADED
        )
        s_completion = (s_completed / s_total * 100) if s_total > 0 else 0.0

        # Attendance rate for current term
        s_att_rate: Optional[float] = None
        if active_term:
            s_att_records = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == student.id,
                    AttendanceRecord.date >= active_term.start_date,
                    AttendanceRecord.date <= active_term.end_date,
                )
                .all()
            )
            s_att_rate = calculate_attendance_rate(s_att_records)

        # Trend: grade series for this student
        s_series = _build_weekly_series(s_graded, type_weights, active_term)
        s_trend = _compute_trend_int(s_series)

        # Effort: based on journal activity
        s_journal_summary = _journal_summary(db, student.id, active_term)
        s_effort = (
            "journaling lapsed" if "No entries" in s_journal_summary else "consistent"
        )

        students_glance.append(
            schemas.StudentGlanceRow(
                student_id=student.id,
                name=f"{student.first_name} {student.last_name}",
                grade=round(s_grade, 1),
                letter=_letter_grade(s_grade, grade_scale),
                trend=s_trend,
                completion=round(s_completion, 1),
                attendance_rate=(
                    round(s_att_rate, 1) if s_att_rate is not None else None
                ),
                effort=s_effort,
                status=_glance_status(s_grade),
            )
        )

    return schemas.AdminReport(
        total_students=total_students,
        active_assignments=active_assignments,
        pending_grades=pending_grades,
        average_grade=round(average_grade, 2),
        total_assignments=total_assignments,
        completed_assignments=completed_assignments,
        kpis=kpis,
        class_average_series=class_average_series,
        subject_averages=subject_averages,
        students_glance=students_glance,
    )


@track_query_performance("get_all_students_progress")
def get_all_students_progress(db: Session, term_id: Optional[int] = None):
    """Get the progress of all students, optionally filtered by term."""
    # 1. Find the appropriate term based on term_id filter
    if term_id:
        # Find the specified term
        active_term = db.query(Term).filter(Term.id == term_id).first()
    else:
        # Use the currently active term
        active_term = db.query(Term).filter(Term.is_active).first()

    students = (
        db.query(User)
        .filter(User.role == UserRole.STUDENT)
        .options(
            joinedload(User.assigned_assignments).joinedload(StudentAssignment.template)
        )
        .all()
    )

    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)

    result = []
    for student in students:
        # Overall stats (all time)
        total_assignments = len(student.assigned_assignments)
        completed_assignments = sum(
            1
            for a in student.assigned_assignments
            if a.status == AssignmentStatus.GRADED
        )

        graded_assignments = [a for a in student.assigned_assignments if _is_graded(a)]
        _, overall_possible, avg_grade = compute_weighted_grade(
            (_grade_item(a) for a in graded_assignments), type_weights
        )

        # Current term grade (effective due date within the selected/active term)
        current_term_grade = 0.0
        term_possible = 0.0
        if active_term:
            term_assignments = [
                a
                for a in graded_assignments
                if active_term.start_date
                <= effective_due_date(a)
                <= active_term.end_date
            ]
            _, term_possible, current_term_grade = compute_weighted_grade(
                (_grade_item(a) for a in term_assignments), type_weights
            )

        # Get subject performance for the student (filtered by term if specified)
        # Note: This could be optimized by batching all students' subject performance queries
        student_subject_performance = get_student_subject_performance(
            db, student.id, term_id=term_id
        )

        # Attendance rate, scoped to the selected/active term's date range and
        # using the recorded-days rule (attended / recorded days).
        if active_term:
            attendance_records = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == student.id,
                    AttendanceRecord.date >= active_term.start_date,
                    AttendanceRecord.date <= active_term.end_date,
                )
                .all()
            )
            student_attendance_rate = calculate_attendance_rate(attendance_records)
        else:
            student_attendance_rate = None

        # Calculate additional fields
        pending_assignments = total_assignments - completed_assignments
        overdue_assignments = sum(
            1
            for a in student.assigned_assignments
            if a.status in [AssignmentStatus.IN_PROGRESS, AssignmentStatus.NOT_STARTED]
            and (a.extended_due_date or a.due_date)
            and (a.extended_due_date or a.due_date) < date.today()
        )
        completion_rate = (
            (completed_assignments / total_assignments * 100)
            if total_assignments > 0
            else 0
        )

        # No graded work → no grade, not an alarming 0%/F.
        current_term_letter_grade = (
            calculate_letter_grade(current_term_grade, grade_scale)
            if term_possible > 0
            else None
        )
        overall_letter_grade = (
            calculate_letter_grade(avg_grade, grade_scale)
            if overall_possible > 0
            else None
        )

        # Get last activity date
        last_activity_date = None
        if student.assigned_assignments:
            latest_assignment = max(
                (a for a in student.assigned_assignments if a.updated_at),
                key=lambda a: a.updated_at,
                default=None,
            )
            if latest_assignment:
                last_activity_date = latest_assignment.updated_at.isoformat()

        grade_series = _build_weekly_series(
            graded_assignments, type_weights, active_term
        )
        s_trend = _compute_trend_int(grade_series)
        journal_str = _journal_summary(db, student.id, active_term)

        result.append(
            schemas.StudentProgress(
                student_id=student.id,
                student_name=f"{student.first_name} {student.last_name}",
                first_name=student.first_name or "",
                last_name=student.last_name or "",
                email=student.email or "",
                grade_level=student.grade_level,
                current_term_percentage=(
                    round(current_term_grade, 2) if term_possible > 0 else None
                ),
                current_term_letter_grade=current_term_letter_grade,
                overall_grade=(
                    round(avg_grade, 2) if overall_possible > 0 else None
                ),
                overall_letter_grade=overall_letter_grade,
                total_assignments=total_assignments,
                completed_assignments=completed_assignments,
                pending_assignments=pending_assignments,
                overdue_assignments=overdue_assignments,
                average_grade=(
                    round(avg_grade, 2) if overall_possible > 0 else None
                ),
                completion_rate=round(completion_rate, 2),
                attendance_rate=(
                    round(student_attendance_rate, 2)
                    if student_attendance_rate is not None
                    else None
                ),
                last_activity_date=last_activity_date,
                subjects=student_subject_performance,
                grade_series=grade_series,
                trend=s_trend,
                journal_summary=journal_str,
            )
        )

    return result


def get_academic_years(db: Session) -> List[schemas.AcademicYear]:
    """Get all academic years from terms."""
    academic_years = (
        db.query(
            Term.academic_year,
            func.min(Term.start_date).label("start_date"),
            func.max(Term.end_date).label("end_date"),
            func.count(Term.id).label("terms_count"),
        )
        .group_by(Term.academic_year)
        .order_by(Term.academic_year.desc())
        .all()
    )

    return [
        schemas.AcademicYear(
            academic_year=year.academic_year,
            start_date=year.start_date,
            end_date=year.end_date,
            terms_count=year.terms_count,
        )
        for year in academic_years
    ]
