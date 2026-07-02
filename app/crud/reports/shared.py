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


"""Shared cross-cutting helpers for report CRUD modules."""

from datetime import date, timedelta
from typing import List, Optional

from app.models.assignment import AssignmentStatus
from app.models.journal import JournalEntry
from app.models.term import Term  # noqa: F401 — referenced in string annotations
from sqlalchemy.orm import Session

from app.utils.grading import calculate_letter_grade, compute_weighted_grade


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
        bucket = [a for a, d in dated if bucket_start <= d < bucket_end]
        # Also capture the last bucket's tail
        if i == num_buckets - 1:
            bucket = [a for a, d in dated if d >= bucket_start]
        if not bucket:
            continue
        _, _, pct = compute_weighted_grade(
            (_grade_item(a) for a in bucket), type_weights
        )
        series.append(round(pct, 1))

    return series


def _journal_summary(
    db: Session, student_id: int, term: Optional["Term"] = None
) -> str:
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
    dates = sorted(
        {
            e.entry_date.date() if hasattr(e.entry_date, "date") else e.entry_date
            for e in entries
        },
        reverse=True,
    )
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
