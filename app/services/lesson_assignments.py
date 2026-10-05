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

Moving a lesson into the drawer preserves existing assignments and their dates;
rescheduling reuses those rows. New assignments follow the explicit draft/on-schedule/now publication policy.

Student work is never destroyed: instead of deleting such an SA we
"orphan" it (``lesson_id = None``, keep the row) and return a warning, so a
parent's real grades survive edits to the lesson that produced them.

A link's ``custom_due_date`` is a fixed override — it does not follow the lesson
date on reschedule. Only links without one have their SA due date track
``lesson.date`` plus the relative due offset (and submitted/graded SAs never move).

No ``commit`` here — the router owns the transaction boundary.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.enums import AssignmentStatus
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
    """True when rescheduling must leave a submitted/graded deadline alone."""
    return (
        bool(sa.is_graded)
        or sa.submitted_date is not None
        or (sa.points_earned is not None)
    )


def _has_work(sa: StudentAssignment) -> bool:
    """Preserve progress and teacher decisions when a link/student is removed."""
    return (
        _is_protected(sa)
        or sa.status != AssignmentStatus.NOT_STARTED
        or sa.started_date is not None
        or sa.completed_date is not None
        or sa.extended_due_date is not None
        or sa.graded_date is not None
        or bool(sa.grade_history)
        or bool(sa.time_spent_minutes)
        or bool(sa.time_entries)
        or bool(sa.student_notes)
        or bool(sa.submission_notes)
        or bool(sa.submission_artifacts)
        or bool(sa.teacher_feedback)
        or bool(sa.paperless_materials)
        or bool(sa.help_requests)
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

    # Placement is not publication: moving to the drawer must not withdraw
    # assignments students already received, even if they haven't started.
    student_ids = [s.id for s in lesson.students]

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
        if _has_work(sa):
            sa.lesson_id = None
            warnings.append(
                f"Kept student work for {_student_label(sa)} "
                "(unlinked from this lesson)"
            )
        else:
            db.delete(sa)

    # --- Reschedule/refresh kept SAs + create missing ones ---
    for key, link in desired.items():
        template_id, student_id = key
        # Keep drawer records exactly as they were. A newly drafted or added
        # template/student gets an assignment only once the lesson is dated.
        sa = kept.get(key)
        timing = link.assignment_timing or "on_schedule"
        if lesson.date is None and sa is not None:
            continue
        if timing == "draft":
            continue
        if lesson.date is None and timing != "now":
            continue
        # A custom due date is a fixed override; otherwise follow the lesson.
        target_due = link.custom_due_date or (
            (lesson.date + timedelta(days=link.due_offset_days or 0))
            if lesson.date
            else None
        )

        sa = kept.get(key)
        if sa is not None:
            if _is_protected(sa):
                # Graded/submitted: never move it across term buckets.
                if sa.due_date != target_due:
                    warnings.append(
                        f"Left the due date on graded/submitted work for "
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


def assignment_impact(lesson_date, students, links, existing, templates):
    """Mirror reconciliation rules without writing; retain duplicate/removal visibility."""
    desired = {
        (link.template_id, student.id): link for link in links for student in students
    }
    student_names = {
        s.id: f"{s.first_name} {s.last_name}".strip() or s.username for s in students
    }
    template_names = {t.id: t.name for t in templates}
    result = []
    kept = {}

    def record(key, sa, action, due, explanation):
        result.append(
            dict(
                assignment_id=sa.id if sa else None,
                student_id=key[1],
                student_name=student_names.get(key[1]) or _student_label(sa),
                template_name=template_names.get(key[0])
                or (sa.template.name if sa and sa.template else "Removed activity"),
                action=action,
                due_date=due,
                explanation=explanation,
            )
        )

    for sa in existing:
        key = (sa.template_id, sa.student_id)
        if key in desired and key not in kept:
            kept[key] = sa
        else:
            record(
                key,
                sa,
                "unlink" if _has_work(sa) else "remove",
                sa.due_date,
                (
                    "Student work stays available separately."
                    if _has_work(sa)
                    else "Untouched generated assignment will be removed."
                ),
            )
    for key, link in desired.items():
        sa = kept.get(key)
        timing = link.assignment_timing or "on_schedule"
        due = link.custom_due_date or (
            lesson_date + timedelta(days=link.due_offset_days or 0)
            if lesson_date
            else None
        )
        if timing == "draft" or (
            lesson_date is None and (sa is not None or timing != "now")
        ):
            record(
                key,
                sa,
                "retain" if sa else "draft",
                sa.due_date if sa else None,
                (
                    "Published assignment and dates stay unchanged."
                    if sa
                    else "Activity stays a draft; no student assignment created."
                ),
            )
        elif sa and _is_protected(sa):
            record(
                key,
                sa,
                "retain",
                sa.due_date,
                "Submitted or graded work keeps its dates and overrides.",
            )
        else:
            action = (
                "create" if sa is None else "reuse" if sa.due_date == due else "move"
            )
            record(
                key,
                sa,
                action,
                due,
                (
                    "Assign to student now."
                    if sa is None
                    else "Reuse the same student record; keep notes and progress."
                ),
            )
    return result
