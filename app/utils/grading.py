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

"""
Shared grading utilities.

Centralized grade calculation to prevent divergence between report-card,
term-grading, and assignment-grading code paths. All report paths compute a
single canonical grade here:

  * Grades use category-percentage weighting: each assignment type carries a
    weight (a percentage). The grade is the weighted average of each type's own
    points-average, using only the types that both have graded work and a
    positive weight. When no type with graded work has a positive weight the
    result falls back to plain points-weighting (``sum(earned) / sum(possible)``),
    which is the neutral default for installs that never configure weights.
  * Term membership is determined by the assignment's effective due date
    (``due_date`` falling back to ``assigned_date``).
"""

from typing import Dict, Iterable, List, Optional, Tuple


def _type_key(assignment_type) -> str:
    """Resolve an assignment type to its string key."""
    if assignment_type is None:
        return ""
    return getattr(assignment_type, "value", None) or str(assignment_type)


def _weight_for(type_weights: Dict[str, float], assignment_type) -> float:
    """Resolve the category weight for an assignment type (default 0.0)."""
    try:
        return float(type_weights.get(_type_key(assignment_type), 0.0))
    except (TypeError, ValueError):
        return 0.0


def compute_weighted_grade(
    items: Iterable[Tuple[Optional[float], Optional[float], object]],
    type_weights: Optional[Dict[str, float]] = None,
) -> Tuple[float, float, float]:
    """Compute a category-weighted grade from graded assignment items.

    Args:
        items: iterable of ``(points_earned, max_points, assignment_type)``.
            Callers should pass only graded items; items with a null
            ``points_earned`` or non-positive ``max_points`` are skipped.
        type_weights: maps assignment-type key -> category weight (a
            percentage). Each type's grade contribution is its own
            points-average scaled by its share of the total active weight.
            When none of the types present carry a positive weight the result
            is identical to plain points-weighting.

    Returns:
        ``(raw_earned, raw_possible, percentage)`` where ``raw_earned`` and
        ``raw_possible`` are the true (unweighted) point sums for display, and
        ``percentage`` is the weighted grade (0.0 when nothing is gradeable).
    """
    type_weights = type_weights or {}
    raw_earned = 0.0
    raw_possible = 0.0
    # Per-type point sums, keyed by type key.
    per_type: Dict[str, Tuple[float, float]] = {}

    for points_earned, max_points, assignment_type in items:
        if points_earned is None or not max_points or max_points <= 0:
            continue
        raw_earned += points_earned
        raw_possible += max_points
        key = _type_key(assignment_type)
        earned, possible = per_type.get(key, (0.0, 0.0))
        per_type[key] = (earned + points_earned, possible + max_points)

    if raw_possible <= 0:
        return raw_earned, raw_possible, 0.0

    # Category-weighted average over types that have a positive weight.
    weighted_sum = 0.0
    weight_total = 0.0
    for key, (earned, possible) in per_type.items():
        if possible <= 0:
            continue
        weight = _weight_for(type_weights, key)
        if weight <= 0:
            continue
        weighted_sum += (earned / possible) * weight
        weight_total += weight

    if weight_total > 0:
        percentage = weighted_sum / weight_total * 100
    else:
        # Neutral fallback: plain points-weighting.
        percentage = raw_earned / raw_possible * 100

    return raw_earned, raw_possible, percentage


def effective_due_date(assignment):
    """Date used to place an assignment in a term: due_date or assigned_date."""
    return assignment.due_date or assignment.assigned_date


def term_membership_filter(term):
    """SQLAlchemy predicate selecting assignments that belong to ``term``.

    Membership is by effective due date — ``due_date`` when present, otherwise
    ``assigned_date`` — between the term's start and end dates (inclusive).
    """
    from sqlalchemy import func

    from app.models.assignment import StudentAssignment

    effective = func.coalesce(
        StudentAssignment.due_date, StudentAssignment.assigned_date
    )
    return (effective >= term.start_date) & (effective <= term.end_date)


def assignment_status_filter(status):
    """SQLAlchemy predicate for filtering student assignments by status string.

    OVERDUE is derived, not stored: the status column only becomes OVERDUE when
    the row happens to be touched, so reports compute overdue on the fly and a
    plain column filter returns almost nothing. Filtering by ``overdue``
    therefore matches unfinished work (not started / in progress / stale
    OVERDUE rows) whose effective due date has passed. Other statuses filter
    the column directly.

    Raises ValueError for unknown status strings (same as AssignmentStatus()).
    """
    from datetime import date

    from sqlalchemy import func

    from app.enums import AssignmentStatus
    from app.models.assignment import StudentAssignment

    status_enum = (
        status if isinstance(status, AssignmentStatus) else AssignmentStatus(status)
    )
    if status_enum != AssignmentStatus.OVERDUE:
        return StudentAssignment.status == status_enum

    effective_due = func.coalesce(
        StudentAssignment.extended_due_date, StudentAssignment.due_date
    )
    return StudentAssignment.status.in_(
        [
            AssignmentStatus.NOT_STARTED,
            AssignmentStatus.IN_PROGRESS,
            AssignmentStatus.OVERDUE,
        ]
    ) & (effective_due < date.today())


_DEFAULT_SCALE: List[Tuple[str, int]] = [
    ("A+", 97),
    ("A", 93),
    ("A-", 90),
    ("B+", 87),
    ("B", 83),
    ("B-", 80),
    ("C+", 77),
    ("C", 73),
    ("C-", 70),
    ("D+", 67),
    ("D", 63),
    ("D-", 60),
    ("F", 0),
]


def calculate_letter_grade(
    percentage: float,
    scale: Optional[List[Tuple[str, int]]] = None,
) -> str:
    """Calculate letter grade from percentage using the configured scale.

    Args:
        percentage: Grade percentage (0–100).
        scale: Ordered list of (letter, min_percent) pairs, highest first.
               Defaults to the built-in A+/A/A- 13-band scale.
    """
    bands = scale if scale is not None else _DEFAULT_SCALE
    for letter, min_pct in bands:
        if percentage >= min_pct:
            return letter
    return bands[-1][0] if bands else "F"
