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

  * Grades are points-weighted with optional per-assignment-type multipliers.
    With neutral (all 1.0) weights this reduces to plain points-weighting,
    i.e. ``sum(earned) / sum(possible)``.
  * Term membership is determined by the assignment's effective due date
    (``due_date`` falling back to ``assigned_date``).
"""

from typing import Dict, Iterable, Optional, Tuple


def _weight_for(type_weights: Dict[str, float], assignment_type) -> float:
    """Resolve the weight multiplier for an assignment type (default 1.0)."""
    if assignment_type is None:
        return 1.0
    key = getattr(assignment_type, "value", None) or str(assignment_type)
    try:
        return float(type_weights.get(key, 1.0))
    except (TypeError, ValueError):
        return 1.0


def compute_weighted_grade(
    items: Iterable[Tuple[Optional[float], Optional[float], object]],
    type_weights: Optional[Dict[str, float]] = None,
) -> Tuple[float, float, float]:
    """Compute a points-weighted grade with optional per-type weights.

    Args:
        items: iterable of ``(points_earned, max_points, assignment_type)``.
            Callers should pass only graded items; items with a null
            ``points_earned`` or non-positive ``max_points`` are skipped.
        type_weights: maps assignment-type value -> weight multiplier. Missing
            types default to 1.0. When every weight is 1.0 the result is
            identical to plain points-weighting.

    Returns:
        ``(raw_earned, raw_possible, percentage)`` where ``raw_earned`` and
        ``raw_possible`` are the true (unweighted) point sums for display, and
        ``percentage`` is the weighted grade (0.0 when nothing is gradeable).
    """
    type_weights = type_weights or {}
    raw_earned = 0.0
    raw_possible = 0.0
    weighted_earned = 0.0
    weighted_possible = 0.0

    for points_earned, max_points, assignment_type in items:
        if points_earned is None or not max_points or max_points <= 0:
            continue
        weight = _weight_for(type_weights, assignment_type)
        raw_earned += points_earned
        raw_possible += max_points
        weighted_earned += points_earned * weight
        weighted_possible += max_points * weight

    percentage = (
        (weighted_earned / weighted_possible * 100) if weighted_possible > 0 else 0.0
    )
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


def calculate_letter_grade(percentage: float) -> str:
    """Calculate letter grade from percentage (A+/A/A- scale).
    
    Uses a 13-band scale with plus/minus granularity.
    
    Args:
        percentage: Grade percentage (0-100)
        
    Returns:
        Letter grade string (e.g. "A+", "B-", "F")
    """
    if percentage >= 97:
        return "A+"
    if percentage >= 93:
        return "A"
    if percentage >= 90:
        return "A-"
    if percentage >= 87:
        return "B+"
    if percentage >= 83:
        return "B"
    if percentage >= 80:
        return "B-"
    if percentage >= 77:
        return "C+"
    if percentage >= 73:
        return "C"
    if percentage >= 70:
        return "C-"
    if percentage >= 67:
        return "D+"
    if percentage >= 63:
        return "D"
    if percentage >= 60:
        return "D-"
    return "F"
