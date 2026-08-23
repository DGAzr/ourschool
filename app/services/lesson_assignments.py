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

"""Reconcile StudentAssignments created by lesson planning.

A lesson links zero or more assignment templates (``lesson.templates``, each a
``LessonTemplate`` with optional per-link overrides). The desired state is one
StudentAssignment per ``(link, selected student)`` pair, carrying that link's
custom due date / max points / instructions. This service diffs that against
the SAs currently linked to the lesson (all matched by ``lesson_id``, then
keyed within the lesson by ``(template_id, student_id)``) and
creates/removes/reschedules to converge.

Graded or submitted work is never destroyed: instead of deleting such an SA we
"orphan" it (``lesson_id = None``, keep the row) and return a warning, so a
parent's real grades survive edits to the lesson that produced them.

A link's ``custom_due_date`` is a fixed override — it does not follow the lesson
date on reschedule. Only links without one have their SA due date track
``lesson.date`` (and graded SAs never move regardless).

No ``commit`` here — the router owns the transaction boundary.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models.assignment import StudentAssignment
from app.models.lesson import Lesson, LessonTemplate


def _student_label(sa: StudentAssignment) -> str:
    """Human-facing student name for warnings; falls back to an id."""
    student = sa.student
    if student is None:
        return f"student #{sa.student_id}"
    name = f"{student.first_name} {student.last_name}".strip()
    return name or student.username


def _is_protected(sa: StudentAssignment) -> bool:
    """True when an SA holds real work that must not be silently deleted."""
    return (
        bool(sa.is_graded)
        or sa.submitted_date is not None
        or (sa.points_earned is not None)
    )


def sync_lesson_assignments(db: Session, lesson: Lesson, *, assigned_by) -> list[str]:
    """Reconcile StudentAssignments linked to ``lesson``. Returns warnings.

    ``assigned_by`` is the acting user id (or None for API keys). Does not
    commit; the caller flushes/commits.
    """
    warnings: list[str] = []

    # Current state: every SA that points at this lesson, keyed within the
    # lesson by (template_id, student_id). Only the first per key is a
    # keep/reschedule candidate; any extras get removed below.
    existing = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.lesson_id == lesson.id)
        .all()
    )

    # Drawer lessons are intentionally not assigned. Moving a lesson into the
    # drawer therefore runs the normal removal/orphaning pass; scheduling it
    # again recreates the desired assignment rows.
    student_ids = [s.id for s in lesson.students] if lesson.date is not None else []

    # Desired state: one SA per (link, selected student). Later links to the
    # same template would collide on the (template_id, student_id) key, so the
    # first link wins per template (the unique constraint already forbids
    # duplicate template links on a lesson).
    desired: dict[tuple[int, int], LessonTemplate] = {}
    for link in lesson.templates:
        if link.template_id is None:
            continue  # template was deleted out from under the link
        for sid in student_ids:
            desired.setdefault((link.template_id, sid), link)

    kept: dict[tuple[int, int], StudentAssignment] = {}
    for sa in existing:
        key = (sa.template_id, sa.student_id)
        if key in desired and key not in kept:
            kept[key] = sa

    # --- Removals: every existing SA that isn't a kept candidate ---
    for sa in existing:
        key = (sa.template_id, sa.student_id)
        if kept.get(key) is sa:
            continue
        if _is_protected(sa):
            sa.lesson_id = None
            warnings.append(
                f"Kept graded/submitted work for {_student_label(sa)} "
                "(unlinked from this lesson)"
            )
        else:
            db.delete(sa)

    # --- Reschedule/refresh kept SAs + create missing ones ---
    for key, link in desired.items():
        template_id, student_id = key
        # A custom due date is a fixed override; otherwise follow the lesson.
        target_due = link.custom_due_date or lesson.date

        sa = kept.get(key)
        if sa is not None:
            if _is_protected(sa):
                # Graded/submitted: never move it across term buckets.
                if sa.due_date != target_due:
                    warnings.append(
                        f"Left the due date on graded work for "
                        f"{_student_label(sa)} unchanged"
                    )
            else:
                sa.due_date = target_due
                sa.custom_max_points = link.custom_max_points
                sa.custom_instructions = link.custom_instructions
            continue

        # Create a fresh SA (copy of the assign-endpoint construction, plus
        # lesson_id and per-link overrides; no active-term gate).
        db.add(
            StudentAssignment(
                template_id=template_id,
                student_id=student_id,
                lesson_id=lesson.id,
                assigned_date=date.today(),
                due_date=target_due,
                custom_max_points=link.custom_max_points,
                custom_instructions=link.custom_instructions,
                assigned_by=assigned_by,
            )
        )

    return warnings
