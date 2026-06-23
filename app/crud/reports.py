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

"""CRUD operations for reports."""
from datetime import date, timedelta
from typing import Dict, List, Optional

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
from app.utils.attendance import (
    calculate_school_days,
    resolve_date_range_from_academic_year,
    calculate_attendance_rate,
    get_attendance_statistics,
    find_first_absence_date,
    generate_recent_activity_summary,
    get_required_days_of_instruction,
)
from app.utils.performance import track_query_performance


from app.utils.grading import (  # noqa: F401 — calculate_letter_grade re-exported for backward compatibility
    calculate_letter_grade,
    compute_weighted_grade,
    effective_due_date,
    term_membership_filter,
)


def _is_graded(assignment) -> bool:
    """Whether an assignment should count toward grade totals.

    Requires a recorded score, and tolerates legacy/imported rows where the
    status was set to GRADED but the ``is_graded`` flag was never written
    (e.g. backup imports). A score of 0 is a valid grade.
    """
    return assignment.points_earned is not None and (
        assignment.is_graded or assignment.status == AssignmentStatus.GRADED
    )


def _grade_item(assignment):
    """Build a (points_earned, max_points, assignment_type) tuple for grading."""
    template = assignment.template
    return (
        assignment.points_earned,
        assignment.custom_max_points or (template.max_points if template else None),
        template.assignment_type if template else None,
    )


def _letter_grade(p: float, scale=None) -> str:
    """Convert percentage to letter grade using the configured scale."""
    return calculate_letter_grade(p, scale)


def _glance_status(overall: float) -> str:
    """Derive the student status label for the overview glance table."""
    if overall >= 88:
        return "Thriving"
    if overall >= 78:
        return "Steady"
    return "Needs attention"


def _build_weekly_series(
    graded_assignments: list,
    type_weights: dict,
    term: "Term",
    num_buckets: int = 8,
) -> List[float]:
    """Bucket graded assignments into ~num_buckets weekly averages over a term."""
    if not graded_assignments or not term:
        return []

    # Use graded_date or fall back to due_date / assigned_date
    def _date(a):
        return getattr(a, "graded_date", None) or a.due_date or a.assigned_date

    dated = [(a, _date(a)) for a in graded_assignments if _date(a)]
    if not dated:
        return []

    dated.sort(key=lambda x: x[1])
    lo = min(d for _, d in dated)
    hi = max(d for _, d in dated)
    total_days = max((hi - lo).days, 1)
    bucket_days = max(total_days // num_buckets, 1)

    series: List[float] = []
    for i in range(num_buckets):
        bucket_start = lo + timedelta(days=i * bucket_days)
        bucket_end = lo + timedelta(days=(i + 1) * bucket_days)
        bucket = [
            a for a, d in dated
            if bucket_start <= d < bucket_end
        ]
        # Also capture the last bucket's tail
        if i == num_buckets - 1:
            bucket = [a for a, d in dated if d >= bucket_start]
        if not bucket:
            continue
        _, _, pct = compute_weighted_grade((_grade_item(a) for a in bucket), type_weights)
        series.append(round(pct, 1))

    return series


def _journal_summary(db: Session, student_id: int, term: Optional["Term"] = None) -> str:
    """Return a short journal effort summary string for the given student."""
    query = db.query(JournalEntry).filter(JournalEntry.student_id == student_id)
    if term:
        query = query.filter(
            JournalEntry.entry_date >= term.start_date,
            JournalEntry.entry_date <= term.end_date,
        )
    entries = query.order_by(JournalEntry.entry_date.desc()).all()
    if not entries:
        return "No journal entries this term"

    total = len(entries)
    # Streak: count consecutive days from most recent
    dates = sorted({e.entry_date.date() if hasattr(e.entry_date, 'date') else e.entry_date for e in entries}, reverse=True)
    streak = 1
    for i in range(1, len(dates)):
        if (dates[i - 1] - dates[i]).days == 1:
            streak += 1
        else:
            break

    # Check for lapsed journaling (>7 days since last entry)
    today = date.today()
    last_date = dates[0]
    days_since = (today - last_date).days
    if days_since > 7:
        return f"No entries in {days_since} days"
    if streak >= 3:
        return f"{streak}-day streak, {total} {'entry' if total == 1 else 'entries'}"
    return f"{total} {'entry' if total == 1 else 'entries'} this term"


def _compute_trend_int(series: List[float]) -> int:
    """Compute signed trend integer from a grade series (last - first)."""
    if len(series) < 2:
        return 0
    return int(round(series[-1] - series[0]))


def get_student_report(db: Session, student_id: int):
    """Get a report for a single student."""
    assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.student_id == student_id)
        .options(joinedload(StudentAssignment.template))
        .all()
    )

    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)

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
            if active_term.start_date
            <= effective_due_date(a)
            <= active_term.end_date
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
            joinedload(User.assigned_assignments).joinedload(
                StudentAssignment.template
            )
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

    average_grade = (
        sum(student_grades) / len(student_grades) if student_grades else 0.0
    )

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
            .join(AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id)
            .filter(
                StudentAssignment.is_graded == True,  # noqa: E712
                StudentAssignment.points_earned.isnot(None),
                term_membership_filter(active_term),
            )
            .options(joinedload(StudentAssignment.template))
            .all()
        )
    class_average_series = _build_weekly_series(all_graded_in_term, type_weights, active_term)

    # Prior-term class average for delta
    prior_avg = 0.0
    if prior_term:
        prior_graded = (
            db.query(StudentAssignment)
            .join(AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id)
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
        (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0.0
    )
    prior_completion = 0.0
    if prior_term and prior_graded:
        # Approximate: completed in prior term / total in prior term
        prior_total_in_term = len(prior_graded)  # graded = completed
        prior_all_in_term = (
            db.query(StudentAssignment)
            .join(AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id)
            .filter(term_membership_filter(prior_term))
            .count()
        )
        prior_completion = (
            prior_total_in_term / prior_all_in_term * 100 if prior_all_in_term > 0 else 0.0
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
            total_present_prior = sum(1 for r in prior_att_records if r.status.value == "present")
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
        if all_student_ids else 0
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
        if all_student_ids else 0
    )

    avg_delta_text, avg_delta_pos = _fmt_delta(average_grade, prior_avg)
    comp_delta_text, comp_delta_pos = _fmt_delta(current_completion, prior_completion)
    att_delta_text, att_delta_pos = _fmt_delta(current_att_rate, prior_att_rate)
    jrnl_diff = journal_count_week - journal_count_prior
    jrnl_delta_text = (
        f"▲ {jrnl_diff} vs last week" if jrnl_diff > 0
        else f"▼ {abs(jrnl_diff)} vs last week" if jrnl_diff < 0
        else "— same as last week"
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
            .join(AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id)
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
                a for a in subj_graded
                if active_term.start_date <= effective_due_date(a) <= active_term.end_date
            ]
        else:
            term_subj_graded = subj_graded
        if not term_subj_graded:
            continue
        _, _, pct = compute_weighted_grade((_grade_item(a) for a in term_subj_graded), type_weights)
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
            1 for a in student.assigned_assignments if a.status == AssignmentStatus.GRADED
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
        s_effort = "journaling lapsed" if "No entries" in s_journal_summary else "consistent"

        students_glance.append(
            schemas.StudentGlanceRow(
                student_id=student.id,
                name=f"{student.first_name} {student.last_name}",
                grade=round(s_grade, 1),
                letter=_letter_grade(s_grade, grade_scale),
                trend=s_trend,
                completion=round(s_completion, 1),
                attendance_rate=round(s_att_rate, 1) if s_att_rate is not None else None,
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


def get_student_term_grades(db: Session, student_id: int, term_id: Optional[int] = None):
    """Calculate term grades for a student, grouped by subject, for the specified or active term."""
    if term_id:
        # Get the specified term
        active_term = db.query(Term).filter(Term.id == term_id).first()
        if not active_term:
            return []
    else:
        active_term = db.query(Term).filter(Term.is_active).first()
        if not active_term:
            return []

    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)

    assignments = (
        db.query(StudentAssignment)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .filter(
            StudentAssignment.student_id == student_id,
            term_membership_filter(active_term),
        )
        .options(
            joinedload(StudentAssignment.template).joinedload(
                AssignmentTemplate.subject
            )
        )
        .all()
    )

    subject_grades = {}
    for assign in assignments:
        if not (assign.template and assign.template.subject):
            continue

        subject = assign.template.subject
        if subject.id not in subject_grades:
            subject_grades[subject.id] = {
                "term_id": active_term.id,
                "term_name": active_term.name,
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_color": subject.color,
                "assignments_count": 0,
                "completed_count": 0,
                "graded_items": [],
            }

        subject_grades[subject.id]["assignments_count"] += 1
        if assign.status == AssignmentStatus.GRADED:
            subject_grades[subject.id]["completed_count"] += 1

        # Only graded assignments contribute to the grade — ungraded ones
        # shouldn't count as 0 earned and unfairly lower the percentage.
        if _is_graded(assign):
            subject_grades[subject.id]["graded_items"].append(_grade_item(assign))

    result = []
    for _subject_id, data in subject_grades.items():
        earned_points, total_points, percentage = compute_weighted_grade(
            data.pop("graded_items"), type_weights
        )
        data["earned_points"] = earned_points
        data["total_points"] = total_points

        letter_grade = calculate_letter_grade(percentage, grade_scale)

        result.append(
            schemas.TermGrade(
                **data, percentage=round(percentage, 2), letter_grade=letter_grade
            )
        )

    return result


def _calculate_subject_trend_data(db: Session, student_id: int, subject_id: int, term_id: Optional[int] = None):
    """Calculate trend data for a specific subject."""
    from app.models.assignment import StudentAssignment, AssignmentTemplate
    
    # Build query for graded assignments in this subject
    query = db.query(StudentAssignment).join(AssignmentTemplate).filter(
        StudentAssignment.student_id == student_id,
        AssignmentTemplate.subject_id == subject_id,
        StudentAssignment.is_graded == True,
        StudentAssignment.percentage_grade.isnot(None),
        StudentAssignment.graded_date.isnot(None)
    )
    
    # Filter by term if specified (membership by effective due date)
    if term_id:
        from app.models.term import Term
        term = db.query(Term).filter(Term.id == term_id).first()
        if term:
            query = query.filter(term_membership_filter(term))
    
    # Get assignments ordered by graded date
    assignments = query.order_by(StudentAssignment.graded_date).all()
    
    if len(assignments) < 2:
        # Not enough data for trend, return current grade if available
        if assignments:
            return [schemas.TrendDataPoint(
                date=assignments[0].graded_date.isoformat(),
                average_grade=assignments[0].percentage_grade,
                assignments_count=1
            )]
        return []
    
    # Create trend buckets - aim for 4-5 data points
    num_buckets = min(5, len(assignments))
    bucket_size = max(1, len(assignments) // num_buckets)
    
    trend_data = []
    for i in range(0, len(assignments), bucket_size):
        bucket_assignments = assignments[i:i + bucket_size]
        if bucket_assignments:
            avg_grade = sum(a.percentage_grade for a in bucket_assignments) / len(bucket_assignments)
            # Use the latest date in the bucket
            latest_date = max(a.graded_date for a in bucket_assignments)
            
            trend_data.append(schemas.TrendDataPoint(
                date=latest_date.isoformat(),
                average_grade=round(avg_grade, 2),
                assignments_count=len(bucket_assignments)
            ))
    
    # Ensure we don't have more than 5 data points
    if len(trend_data) > 5:
        # Take evenly distributed points
        indices = [int(i * (len(trend_data) - 1) / 4) for i in range(5)]
        trend_data = [trend_data[i] for i in indices]
    
    return trend_data


def get_student_subject_performance(db: Session, student_id: int, term_id: Optional[int] = None):
    """Get a student's performance by subject, optionally filtered by term."""
    grade_scale = crud_settings.get_grade_scale(db)
    term_grades_by_subject = {}

    term_grades = get_student_term_grades(db, student_id, term_id=term_id)

    for grade in term_grades:
        if grade.subject_id not in term_grades_by_subject:
            term_grades_by_subject[grade.subject_id] = {
                "subject_id": grade.subject_id,
                "subject_name": grade.subject_name,
                "total_assignments": 0,
                "completed_assignments": 0,
                "total_percentage": 0,
                "term_count": 0,
                "terms": [],
            }

        subj_data = term_grades_by_subject[grade.subject_id]
        subj_data["total_assignments"] += grade.assignments_count
        subj_data["completed_assignments"] += grade.completed_count
        subj_data["terms"].append(grade)

    result = []
    for _subject_id, data in term_grades_by_subject.items():
        # Roll terms up by point volume rather than averaging per-term
        # percentages, so a low-volume term doesn't count as much as a
        # high-volume one. Each term percentage is already type-weighted.
        points_earned = sum(term.earned_points for term in data["terms"])
        points_possible = sum(term.total_points for term in data["terms"])
        if points_possible > 0:
            avg_percentage = (
                sum(term.percentage * term.total_points for term in data["terms"])
                / points_possible
            )
        else:
            avg_percentage = 0.0

        # Calculate trend data for this subject
        trend_data = _calculate_subject_trend_data(db, student_id, data["subject_id"], term_id)

        result.append(
            schemas.SubjectPerformance(
                subject_id=data["subject_id"],
                subject_name=data["subject_name"],
                average_percentage=round(avg_percentage, 2),
                letter_grade=calculate_letter_grade(avg_percentage, grade_scale),
                total_assignments=data["total_assignments"],
                completed_assignments=data["completed_assignments"],
                points_earned=points_earned,
                points_possible=points_possible,
                terms=data["terms"],
                trend_data=trend_data,
            )
        )

    return result


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
            joinedload(User.assigned_assignments).joinedload(
                StudentAssignment.template
            )
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

        graded_assignments = [
            a for a in student.assigned_assignments if _is_graded(a)
        ]
        _, _, avg_grade = compute_weighted_grade(
            (_grade_item(a) for a in graded_assignments), type_weights
        )

        # Current term grade (effective due date within the selected/active term)
        current_term_grade = 0.0
        if active_term:
            term_assignments = [
                a
                for a in graded_assignments
                if active_term.start_date
                <= effective_due_date(a)
                <= active_term.end_date
            ]
            _, _, current_term_grade = compute_weighted_grade(
                (_grade_item(a) for a in term_assignments), type_weights
            )

        # Get subject performance for the student (filtered by term if specified)
        # Note: This could be optimized by batching all students' subject performance queries
        student_subject_performance = get_student_subject_performance(db, student.id, term_id=term_id)

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
            1 for a in student.assigned_assignments
            if a.status in [AssignmentStatus.IN_PROGRESS, AssignmentStatus.NOT_STARTED]
            and (a.extended_due_date or a.due_date)
            and (a.extended_due_date or a.due_date) < date.today()
        )
        completion_rate = (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0

        current_term_letter_grade = calculate_letter_grade(current_term_grade, grade_scale)
        overall_letter_grade = calculate_letter_grade(avg_grade, grade_scale)

        # Get last activity date
        last_activity_date = None
        if student.assigned_assignments:
            latest_assignment = max(
                (a for a in student.assigned_assignments if a.updated_at),
                key=lambda a: a.updated_at,
                default=None
            )
            if latest_assignment:
                last_activity_date = latest_assignment.updated_at.isoformat()

        grade_series = _build_weekly_series(graded_assignments, type_weights, active_term)
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
                current_term_percentage=round(current_term_grade, 2),
                current_term_letter_grade=current_term_letter_grade,
                overall_grade=round(avg_grade, 2),
                overall_letter_grade=overall_letter_grade,
                total_assignments=total_assignments,
                completed_assignments=completed_assignments,
                pending_assignments=pending_assignments,
                overdue_assignments=overdue_assignments,
                average_grade=round(avg_grade, 2),
                completion_rate=round(completion_rate, 2),
                attendance_rate=round(student_attendance_rate, 2) if student_attendance_rate is not None else None,
                last_activity_date=last_activity_date,
                subjects=student_subject_performance,
                subject_grades=student_subject_performance,  # Provide both for compatibility
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


# Note: calculate_school_days function moved to app.utils.attendance


@track_query_performance("get_student_attendance_report")
def get_student_attendance_report(
    db: Session,
    student_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    academic_year: Optional[str] = None,
) -> schemas.StudentAttendanceReport:
    """Get detailed attendance report for a specific student."""
    
    # Resolve date range using utility function
    start_date, end_date = resolve_date_range_from_academic_year(
        db, academic_year, start_date, end_date
    )
    # Get student info
    student = (
        db.query(User)
        .filter(User.id == student_id, User.role == UserRole.STUDENT)
        .first()
    )

    if not student:
        raise ValueError("Student not found")

    # Get attendance records
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date,
        )
        .order_by(AttendanceRecord.date)
        .all()
    )

    # Calculate totals using utility functions
    total_school_days = calculate_school_days(start_date, end_date)
    required_days_of_instruction = get_required_days_of_instruction(db)
    
    # Get attendance statistics
    attendance_stats = get_attendance_statistics(attendance_records)
    # Use school-days denominator so unrecorded days accurately lower the rate.
    attendance_rate = calculate_attendance_rate(attendance_records, total_school_days=total_school_days) or 0.0
    first_absence_date = find_first_absence_date(attendance_records)
    recent_activity_summary = generate_recent_activity_summary(attendance_records)

    # Create summary
    summary = schemas.AttendanceReportSummary(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        student_first_name=student.first_name,
        student_last_name=student.last_name,
        grade_level=student.grade_level,
        total_school_days=total_school_days,
        total_possible_days=total_school_days,  # Alias for frontend
        required_days_of_instruction=required_days_of_instruction,
        present_days=attendance_stats["present_days"],
        absent_days=attendance_stats["absent_days"],
        late_days=attendance_stats["late_days"],
        excused_days=attendance_stats["excused_days"],
        attendance_rate=round(attendance_rate, 2),
        attendance_percentage=round(attendance_rate, 2),  # Alias for frontend
        start_date=start_date,
        end_date=end_date,
        first_absence_date=first_absence_date,
        recent_activity_summary=recent_activity_summary,
    )

    # Create daily records
    daily_records = [
        schemas.AttendanceReportDetail(
            date=record.date, status=record.status.value, notes=record.notes
        )
        for record in attendance_records
    ]

    return schemas.StudentAttendanceReport(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        grade_level=student.grade_level,
        academic_year=academic_year,
        summary=summary,
        daily_records=daily_records,
        daily_attendance=daily_records,  # Alias for frontend
    )


@track_query_performance("get_bulk_attendance_report")
def get_bulk_attendance_report(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    academic_year: Optional[str] = None,
) -> schemas.BulkAttendanceReport:
    """Get attendance report for all students (admin view)."""
    
    # Resolve date range using utility function
    start_date, end_date = resolve_date_range_from_academic_year(
        db, academic_year, start_date, end_date
    )
    # Get all students - no admin filtering in homeschool context
    students_query = db.query(User).filter(User.role == UserRole.STUDENT)
    students = students_query.all()

    # Calculate total school days and get required instruction days
    total_school_days = calculate_school_days(start_date, end_date)
    required_days_of_instruction = get_required_days_of_instruction(db)

    student_summaries = []

    for student in students:
        # Get attendance records for this student
        attendance_records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.date >= start_date,
                AttendanceRecord.date <= end_date,
            )
            .all()
        )

        # Calculate totals using utility functions
        attendance_stats = get_attendance_statistics(attendance_records)
        # Use school-days denominator so unrecorded days accurately lower the rate.
        attendance_rate = calculate_attendance_rate(attendance_records, total_school_days=total_school_days) or 0.0
        first_absence_date = find_first_absence_date(attendance_records)
        recent_activity_summary = generate_recent_activity_summary(attendance_records)

        student_summaries.append(
            schemas.AttendanceReportSummary(
                student_id=student.id,
                student_name=f"{student.first_name} {student.last_name}",
                student_first_name=student.first_name,
                student_last_name=student.last_name,
                grade_level=student.grade_level,
                total_school_days=total_school_days,
                total_possible_days=total_school_days,  # Alias for frontend
                required_days_of_instruction=required_days_of_instruction,
                present_days=attendance_stats["present_days"],
                absent_days=attendance_stats["absent_days"],
                late_days=attendance_stats["late_days"],
                excused_days=attendance_stats["excused_days"],
                attendance_rate=round(attendance_rate, 2),
                attendance_percentage=round(attendance_rate, 2),  # Alias for frontend
                start_date=start_date,
                end_date=end_date,
                first_absence_date=first_absence_date,
                recent_activity_summary=recent_activity_summary,
            )
        )

    # Calculate overall statistics
    total_students = len(student_summaries)
    total_present = sum(s.present_days for s in student_summaries)
    total_absent = sum(s.absent_days for s in student_summaries)
    total_late = sum(s.late_days for s in student_summaries)
    total_excused = sum(s.excused_days for s in student_summaries)
    average_attendance_rate = (
        sum(s.attendance_rate for s in student_summaries) / total_students
        if total_students > 0 else 0.0
    )
    
    overall_stats = schemas.BulkAttendanceReportOverallStats(
        total_students=total_students,
        average_attendance_rate=round(average_attendance_rate, 2),
        total_present=total_present,
        total_absent=total_absent,
        total_late=total_late,
        total_excused=total_excused,
    )
    
    return schemas.BulkAttendanceReport(
        academic_year=academic_year,
        start_date=start_date,
        end_date=end_date,
        total_school_days=total_school_days,
        students=student_summaries,
        student_attendance=student_summaries,  # Alias for frontend
        overall_stats=overall_stats,
    )


@track_query_performance("get_assignment_report")
def get_assignment_report(
    db: Session,
    subject_id: Optional[int] = None,
    student_id: Optional[int] = None,
    term_id: Optional[int] = None,
    status: Optional[str] = None,
) -> schemas.AssignmentReport:
    """Get comprehensive assignment report with filtering options."""
    # Create aliases for User table to avoid conflicts
    student_alias = db.query(User).subquery().alias("student")
    assigned_by_user_alias = db.query(User).subquery().alias("assigned_by_user")

    # Base query for assignments with all related data
    query = (
        db.query(
            StudentAssignment.id.label("assignment_id"),
            StudentAssignment.template_id,
            AssignmentTemplate.name.label("assignment_name"),
            AssignmentTemplate.assignment_type,
            StudentAssignment.student_id,
            func.concat(
                student_alias.c.first_name, " ", student_alias.c.last_name
            ).label("student_name"),
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            Subject.color.label("subject_color"),
            StudentAssignment.assigned_date,
            StudentAssignment.due_date,
            StudentAssignment.status,
            StudentAssignment.points_earned,
            func.coalesce(
                StudentAssignment.custom_max_points, AssignmentTemplate.max_points
            ).label("max_points"),
            StudentAssignment.percentage_grade,
            StudentAssignment.letter_grade,
            StudentAssignment.is_graded,
            StudentAssignment.graded_date,
            StudentAssignment.teacher_feedback,
            StudentAssignment.time_spent_minutes,
            func.concat(
                assigned_by_user_alias.c.first_name,
                " ",
                assigned_by_user_alias.c.last_name,
            ).label("assigned_by_name"),
        )
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .join(student_alias, StudentAssignment.student_id == student_alias.c.id)
        .join(Subject, AssignmentTemplate.subject_id == Subject.id)
        .join(
            assigned_by_user_alias,
            StudentAssignment.assigned_by == assigned_by_user_alias.c.id,
        )
    )

    # Apply filters
    # Note: No admin filtering in homeschool context - all admins can see all students

    if subject_id:
        query = query.filter(Subject.id == subject_id)

    if student_id:
        query = query.filter(StudentAssignment.student_id == student_id)

    if term_id:
        term = db.query(Term).filter(Term.id == term_id).first()
        if term:
            query = query.filter(term_membership_filter(term))

    if status:
        query = query.filter(StudentAssignment.status == status)

    # Execute query and get results
    assignment_data = query.order_by(StudentAssignment.assigned_date.desc()).all()

    # Pre-fetch all terms once for efficient date-range lookup
    all_terms = db.query(Term).all()

    def _find_term_for_date(d):
        """Find term containing date d using linear scan over terms."""
        if not d:
            return None, None
        for t in all_terms:
            if t.start_date <= d <= t.end_date:
                return t.id, t.name
        return None, None

    # Build assignment list
    assignments = []

    for data in assignment_data:
        # Tag with the term containing the effective due date (due_date or assigned_date)
        term_id_for_assignment, term_name_for_assignment = _find_term_for_date(
            data.due_date or data.assigned_date
        )

        assignments.append(
            schemas.AssignmentReportItem(
                assignment_id=data.assignment_id,
                template_id=data.template_id,
                assignment_name=data.assignment_name,
                assignment_type=(
                    data.assignment_type if data.assignment_type else "Unknown"
                ),
                student_id=data.student_id,
                student_name=data.student_name,
                subject_id=data.subject_id,
                subject_name=data.subject_name,
                subject_color=data.subject_color,
                term_id=term_id_for_assignment,
                term_name=term_name_for_assignment,
                assigned_date=data.assigned_date,
                due_date=data.due_date,
                status=data.status.value if data.status else "Unknown",
                points_earned=data.points_earned,
                max_points=data.max_points,
                percentage_grade=data.percentage_grade,
                letter_grade=data.letter_grade,
                is_graded=data.is_graded,
                graded_date=data.graded_date,
                teacher_feedback=data.teacher_feedback,
                time_spent_minutes=data.time_spent_minutes or 0,
                assigned_by_name=data.assigned_by_name,
            )
        )

    # Calculate summary statistics
    total_assignments = len(assignments)
    graded_assignments = sum(1 for a in assignments if a.is_graded)
    pending_assignments = sum(
        1 for a in assignments if a.status == AssignmentStatus.SUBMITTED.value
    )
    overdue_assignments = sum(1 for a in assignments if a.status == "overdue")

    # Calculate average grade
    graded_with_scores = [
        a for a in assignments if a.is_graded and a.percentage_grade is not None
    ]
    average_grade = (
        sum(a.percentage_grade for a in graded_with_scores) / len(graded_with_scores)
        if graded_with_scores
        else None
    )

    # Get unique counts
    subjects_count = len({a.subject_id for a in assignments})
    students_count = len({a.student_id for a in assignments})

    summary = schemas.AssignmentReportSummary(
        total_assignments=total_assignments,
        graded_assignments=graded_assignments,
        pending_assignments=pending_assignments,
        overdue_assignments=overdue_assignments,
        average_grade=round(average_grade, 2) if average_grade else None,
        subjects_count=subjects_count,
        students_count=students_count,
    )

    # Get available filter options
    base_student_query = db.query(
        User.id, func.concat(User.first_name, " ", User.last_name).label("name")
    ).filter(User.role == UserRole.STUDENT)
    # Note: No admin filtering in homeschool context - all admins can see all students

    available_subjects = [
        {"id": s.id, "name": s.name, "color": s.color}
        for s in db.query(Subject).order_by(Subject.name).all()
    ]

    available_students = [
        {"id": s.id, "name": s.name}
        for s in base_student_query.order_by(User.first_name, User.last_name).all()
    ]

    available_terms = [
        {"id": t.id, "name": t.name, "academic_year": t.academic_year}
        for t in db.query(Term).order_by(Term.start_date.desc()).all()
    ]

    return schemas.AssignmentReport(
        summary=summary,
        assignments=assignments,
        available_subjects=available_subjects,
        available_students=available_students,
        available_terms=available_terms,
    )


@track_query_performance("get_report_card")
def get_report_card(
    db: Session, student_id: int, term_id: int
) -> schemas.ReportCard:
    """Generate a comprehensive report card for a student for a specific term."""
    # Get student information
    student = db.query(User).filter(
        User.id == student_id, User.role == UserRole.STUDENT
    ).first()
    if not student:
        raise ValueError("Student not found or access denied")

    # Get term information
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError("Term not found")

    type_weights = crud_settings.get_assignment_type_weights(db)
    grade_scale = crud_settings.get_grade_scale(db)

    # Get all assignments for this student in this term (membership by due date)
    assignments_query = (
        db.query(StudentAssignment, AssignmentTemplate, Subject)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .join(Subject, AssignmentTemplate.subject_id == Subject.id)
        .filter(
            StudentAssignment.student_id == student_id,
            term_membership_filter(term),
        )
        .all()
    )

    # Group assignments by subject and collect graded items
    subject_grades = {}
    overall_items = []
    overall_total_assignments = 0
    overall_completed = 0

    for assignment, template, subject in assignments_query:
        if subject.id not in subject_grades:
            subject_grades[subject.id] = {
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_color": subject.color,
                "assignments_completed": 0,
                "assignments_total": 0,
                "graded_items": [],
            }

        subject_data = subject_grades[subject.id]
        subject_data["assignments_total"] += 1
        overall_total_assignments += 1

        # Only graded assignments contribute to the grade — ungraded ones
        # should not count against the student's percentage.
        if _is_graded(assignment):
            item = (
                assignment.points_earned,
                assignment.custom_max_points or template.max_points,
                template.assignment_type,
            )
            subject_data["graded_items"].append(item)
            subject_data["assignments_completed"] += 1
            overall_items.append(item)
            overall_completed += 1

    # Calculate subject grades and letter grades
    report_card_subjects = []
    for _subject_id, data in subject_grades.items():
        points_earned, points_possible, percentage = compute_weighted_grade(
            data["graded_items"], type_weights
        )

        report_card_subjects.append(
            schemas.ReportCardSubjectGrade(
                subject_id=data["subject_id"],
                subject_name=data["subject_name"],
                subject_color=data["subject_color"],
                assignments_completed=data["assignments_completed"],
                assignments_total=data["assignments_total"],
                points_earned=points_earned,
                points_possible=points_possible,
                percentage_grade=round(percentage, 2),
                letter_grade=calculate_letter_grade(percentage, grade_scale),
            )
        )

    # Calculate overall grade
    _, _, overall_percentage = compute_weighted_grade(overall_items, type_weights)
    overall_letter_grade = calculate_letter_grade(overall_percentage, grade_scale)

    # Get attendance data for the term (attended / recorded days)
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= term.start_date,
            AttendanceRecord.date <= term.end_date,
        )
        .all()
    )

    attendance_stats = get_attendance_statistics(attendance_records)
    days_present = attendance_stats["present_days"]
    days_absent = attendance_stats["absent_days"]
    days_late = attendance_stats["late_days"]
    attendance_rate = calculate_attendance_rate(attendance_records)

    # Create summary
    summary = schemas.ReportCardSummary(
        overall_percentage=round(overall_percentage, 2),
        overall_letter_grade=overall_letter_grade,
        total_assignments=overall_total_assignments,
        completed_assignments=overall_completed,
        subjects_count=len(subject_grades),
        attendance_rate=round(attendance_rate, 2) if attendance_rate is not None else None,
        days_present=days_present,
        days_absent=days_absent,
        days_late=days_late,
    )

    # Get student's grade level from student profile if available
    student_profile = db.query(User).filter(User.id == student_id).first()
    grade_level = getattr(student_profile, "grade_level", None)

    # Find next term for information
    next_term = (
        db.query(Term)
        .filter(
            Term.start_date > term.end_date, Term.academic_year == term.academic_year
        )
        .order_by(Term.start_date)
        .first()
    )

    if not next_term:
        # Look for next academic year
        next_term = (
            db.query(Term)
            .filter(Term.academic_year > term.academic_year)
            .order_by(Term.academic_year, Term.start_date)
            .first()
        )

    next_term_info = (
        f"Next term: {next_term.name}" if next_term else "End of academic year"
    )

    return schemas.ReportCard(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        student_grade_level=grade_level,
        term_id=term.id,
        term_name=term.name,
        academic_year=term.academic_year,
        term_start_date=term.start_date,
        term_end_date=term.end_date,
        generated_date=date.today(),
        summary=summary,
        subject_grades=report_card_subjects,
        next_term_info=next_term_info,
    )