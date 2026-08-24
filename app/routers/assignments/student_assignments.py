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

"""Student assignment endpoints: assigning templates and student assignment lifecycle."""

import json
import logging
from datetime import date, datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.crud.settings import get_assignment_type_weights, get_grade_scale
from app.crud import assignment_types as crud_assignment_types

from app.core.database import get_db
from app.models.assignment import (
    AssignmentTimeEntry,
    AssignmentStatus,
    AssignmentTemplate,
    StudentAssignment,
)
from app.models.subject import Subject
from app.models.paperless import (
    PaperlessDocument,
    StudentAssignmentPaperlessMaterial,
    snapshot_fields,
)
from app.models.term import GradeHistory, StudentTermGrade, Term, TermSubject
from app.models.user import User, UserRole
from app.core.dual_auth import (
    AuthUser,
    get_user_id_from_auth,
    is_admin_user,
    is_student_user,
    require_admin_or_permission,
    require_admin_or_student_self_or_permission,
    require_student_session,
)
from app.schemas.assignment import (
    AssignmentAssignmentRequest,
    AssignmentAssignmentResponse,
    StudentAssignmentCompleteRequest,
    StudentAssignmentResponse,
    StudentAssignmentUpdate,
    StudentCreatedAssignmentCreate,
    StudentCreatedAssignmentUpdate,
    AssignmentTimeEntryCreate,
    AssignmentTimeEntryResponse,
    AssignmentTimeEntryUpdate,
)
from app.utils.grading import (
    assignment_status_filter,
    calculate_letter_grade,
    compute_weighted_grade,
    term_membership_filter,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Assignment Assignment (Assigning templates to students)


@router.post("/assign", response_model=AssignmentAssignmentResponse)
def assign_template_to_students(
    assignment_request: AssignmentAssignmentRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Assign an assignment template to multiple students (admin session or API key with assignments:write)."""
    # Find active term
    active_term = db.query(Term).filter(Term.is_active).first()
    if not active_term:
        raise HTTPException(
            status_code=400,
            detail="No active term found. "
            "Please set an active term before assigning assignments.",
        )

    # Verify template exists (admins and authorized API keys can use any template)
    template = (
        db.query(AssignmentTemplate)
        .filter(AssignmentTemplate.id == assignment_request.template_id)
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Assignment template not found")

    if template.is_archived:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign an archived template. Unarchive it first.",
        )

    if (
        db.query(StudentAssignment)
        .filter(
            StudentAssignment.template_id == template.id,
            StudentAssignment.is_student_created,
        )
        .first()
    ):
        raise HTTPException(
            status_code=400,
            detail="Student-created assignments are private one-offs and cannot be reassigned",
        )

    # Verify all students exist (admins can assign to any student in homeschool)
    students = (
        db.query(User)
        .filter(
            User.id.in_(assignment_request.student_ids),
            User.role == UserRole.STUDENT,
            User.is_active,
        )
        .all()
    )

    found_student_ids = {student.id for student in students}
    missing_student_ids = set(assignment_request.student_ids) - found_student_ids

    if missing_student_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Students with IDs {list(missing_student_ids)} "
            "not found or access denied",
        )

    # One-off Paperless materials for every assignment in this batch —
    # validated up front so a bad document id fails the whole request before
    # anything is created.
    doc_ids = list(dict.fromkeys(assignment_request.paperless_document_ids))
    docs = (
        db.query(PaperlessDocument).filter(PaperlessDocument.id.in_(doc_ids)).all()
        if doc_ids
        else []
    )
    missing_doc_ids = set(doc_ids) - {doc.id for doc in docs}
    if missing_doc_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Paperless documents with IDs "
            f"{sorted(missing_doc_ids)} not found",
        )
    material_snapshots = [(doc.id, snapshot_fields(doc)) for doc in docs]

    created_assignments = []
    failed_assignments = []

    # Use current date for assignment date, or the provided one
    assigned_date = assignment_request.assigned_date or date.today()
    assigned_by = get_user_id_from_auth(auth_user)  # None for API keys

    for student_id in assignment_request.student_ids:
        try:
            # Allow multiple assignments of the same template to the same student
            # (templates are reusable for practice, retakes, etc.)
            student_assignment = StudentAssignment(
                template_id=assignment_request.template_id,
                student_id=student_id,
                assigned_date=assigned_date,
                due_date=assignment_request.due_date,
                custom_instructions=assignment_request.custom_instructions,
                custom_max_points=assignment_request.custom_max_points,
                assigned_by=assigned_by,
            )
            student_assignment.paperless_materials = [
                StudentAssignmentPaperlessMaterial(document_id=doc_id, **snap)
                for doc_id, snap in material_snapshots
            ]

            db.add(student_assignment)
            created_assignments.append(student_assignment)

        except Exception as e:
            failed_assignments.append({"student_id": student_id, "error": str(e)})

    db.commit()

    # Refresh created assignments
    for assignment in created_assignments:
        db.refresh(assignment)

    logger.info(
        "Assigned template %s to %s students",
        assignment_request.template_id,
        len(created_assignments),
    )

    return AssignmentAssignmentResponse(
        success_count=len(created_assignments),
        failed_assignments=failed_assignments,
        created_assignments=created_assignments,
    )


# Student Assignment Management


@router.get(
    "/students/{student_id}/assignments", response_model=List[StudentAssignmentResponse]
)
def get_student_assignments(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:read")),
    ],
    subject_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    include_archived: bool = Query(False),
):
    """Get assignments for a specific student."""
    if is_admin_user(auth_user):
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    elif isinstance(auth_user, User) and is_student_user(auth_user):
        if auth_user.id != student_id:
            raise HTTPException(
                status_code=403, detail="Students can only view their own assignments"
            )

    query = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.template))
        .filter(StudentAssignment.student_id == student_id)
    )

    if not include_archived:
        query = query.filter(StudentAssignment.status != AssignmentStatus.EXCUSED)

    if subject_id:
        query = query.join(AssignmentTemplate).filter(
            AssignmentTemplate.subject_id == subject_id
        )

    if status:
        try:
            query = query.filter(assignment_status_filter(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status '{status}'")

    assignments = query.all()
    return assignments


@router.get(
    "/student-assignments/{assignment_id}", response_model=StudentAssignmentResponse
)
def get_student_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:read")),
    ],
):
    """Get a specific student assignment by ID."""
    assignment = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.template))
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    # Students may only view their own assignments
    if isinstance(auth_user, User) and is_student_user(auth_user):
        if auth_user.id != assignment.student_id:
            raise HTTPException(
                status_code=403, detail="Students can only view their own assignments"
            )

    return assignment


# Fields a student may modify on their own assignment; everything else
# (due dates, assigned date, instructions, max points) is admin-only.
STUDENT_EDITABLE_ASSIGNMENT_FIELDS = {
    "status",
    "student_notes",
    "submission_notes",
    "submission_artifacts",
}


def _term_for_assignment(db: Session, assignment: StudentAssignment) -> Optional[Term]:
    effective_date = (
        assignment.extended_due_date or assignment.due_date or assignment.assigned_date
    )
    if effective_date:
        term = (
            db.query(Term)
            .filter(Term.start_date <= effective_date, Term.end_date >= effective_date)
            .order_by(Term.start_date.desc())
            .first()
        )
        if term:
            return term
    return db.query(Term).filter(Term.is_active).first()


def _record_grade_changes(
    db: Session,
    grade: StudentTermGrade,
    before: dict,
    assignment_id: int,
    changed_by: Optional[int],
) -> None:
    for field, old_value in before.items():
        new_value = getattr(grade, field)
        if old_value != new_value:
            db.add(
                GradeHistory(
                    student_term_grade_id=grade.id,
                    field_name=field,
                    old_value=None if old_value is None else str(old_value),
                    new_value=None if new_value is None else str(new_value),
                    change_reason="Assigned assignment edited",
                    changed_by=changed_by,
                    assignment_id=assignment_id,
                )
            )


def _recalculate_term_subject(
    db: Session,
    *,
    student_id: int,
    subject_id: int,
    term: Optional[Term],
    assignment_id: int,
    changed_by: Optional[int],
) -> None:
    """Rebuild one persisted term/subject grade, including the empty case."""
    if term is None:
        return

    term_subject = (
        db.query(TermSubject)
        .filter(
            TermSubject.term_id == term.id,
            TermSubject.subject_id == subject_id,
        )
        .first()
    )
    assignments = (
        db.query(StudentAssignment)
        .join(AssignmentTemplate)
        .filter(
            StudentAssignment.student_id == student_id,
            AssignmentTemplate.subject_id == subject_id,
            term_membership_filter(term),
        )
        .all()
    )
    if term_subject is None:
        if not assignments:
            return
        term_subject = TermSubject(term_id=term.id, subject_id=subject_id)
        db.add(term_subject)
        db.flush()

    grade = (
        db.query(StudentTermGrade)
        .filter(
            StudentTermGrade.student_id == student_id,
            StudentTermGrade.term_subject_id == term_subject.id,
        )
        .first()
    )
    if grade is None:
        grade = StudentTermGrade(student_id=student_id, term_subject_id=term_subject.id)
        db.add(grade)
        db.flush()

    audited_fields = (
        "current_points_earned",
        "current_points_possible",
        "current_percentage",
        "current_letter_grade",
        "assignments_completed",
        "assignments_total",
    )
    before = {field: getattr(grade, field) for field in audited_fields}
    graded = [
        item
        for item in assignments
        if item.points_earned is not None
        and (item.is_graded or item.status == AssignmentStatus.GRADED)
    ]
    earned, possible, percentage = compute_weighted_grade(
        (
            (item.points_earned, item.max_points, item.template.assignment_type)
            for item in graded
        ),
        get_assignment_type_weights(db),
    )
    grade.current_points_earned = earned
    grade.current_points_possible = possible
    grade.current_percentage = round(percentage, 2) if possible > 0 else None
    grade.current_letter_grade = (
        calculate_letter_grade(percentage, get_grade_scale(db))
        if possible > 0
        else None
    )
    grade.assignments_completed = len(graded)
    grade.assignments_total = len(assignments)
    grade.last_calculated = datetime.now(timezone.utc)
    db.flush()
    _record_grade_changes(db, grade, before, assignment_id, changed_by)


@router.put(
    "/student-assignments/{assignment_id}", response_model=StudentAssignmentResponse
)
def update_student_assignment(
    assignment_id: int,
    assignment_update: StudentAssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:write")),
    ],
):
    """Update a student assignment."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    if is_admin_user(auth_user):
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    elif isinstance(auth_user, User) and is_student_user(auth_user):
        if auth_user.id != assignment.student_id:
            raise HTTPException(
                status_code=403, detail="Students can only update their own assignments"
            )

    update_data = assignment_update.dict(exclude_unset=True)

    if isinstance(auth_user, User) and is_student_user(auth_user):
        disallowed = set(update_data) - STUDENT_EDITABLE_ASSIGNMENT_FIELDS
        if disallowed:
            raise HTTPException(
                status_code=403,
                detail=f"You may not modify: {', '.join(sorted(disallowed))}",
            )
        # Excusing (archiving) an assignment is an admin decision.
        if update_data.get("status") == AssignmentStatus.EXCUSED:
            raise HTTPException(
                status_code=403,
                detail="Only admins can mark an assignment as excused",
            )

    # Handle submission_artifacts JSON serialization
    if (
        "submission_artifacts" in update_data
        and update_data["submission_artifacts"] is not None
    ):
        update_data["submission_artifacts"] = json.dumps(
            update_data["submission_artifacts"]
        )

    # Handle status change workflow
    if "status" in update_data:
        new_status = update_data["status"]
        today = date.today()

        # Set appropriate dates based on status transition
        if new_status == AssignmentStatus.IN_PROGRESS and not assignment.started_date:
            assignment.started_date = today
        elif new_status == AssignmentStatus.SUBMITTED and not assignment.submitted_date:
            assignment.submitted_date = today
            # Also ensure it was started
            if not assignment.started_date:
                assignment.started_date = today

    was_graded = assignment.is_graded and assignment.points_earned is not None
    old_term = _term_for_assignment(db, assignment) if was_graded else None
    subject_id = assignment.template.subject_id if assignment.template else None

    # Apply all updates
    for field, value in update_data.items():
        setattr(assignment, field, value)

    if was_graded and "custom_max_points" in update_data:
        assignment.calculate_percentage_grade()
        assignment.letter_grade = calculate_letter_grade(
            assignment.percentage_grade, get_grade_scale(db)
        )

    # Auto-update status based on changes (this will handle other cases)
    assignment.update_status()

    if was_graded and subject_id is not None:
        db.flush()
        new_term = _term_for_assignment(db, assignment)
        actor_id = get_user_id_from_auth(auth_user)
        affected_terms = {term.id: term for term in (old_term, new_term) if term}
        for term in affected_terms.values():
            _recalculate_term_subject(
                db,
                student_id=assignment.student_id,
                subject_id=subject_id,
                term=term,
                assignment_id=assignment.id,
                changed_by=actor_id,
            )

    db.commit()
    db.refresh(assignment)

    return assignment


def _validate_student_assignment_definition(
    db: Session, subject_id: int, assignment_type: str
) -> None:
    if db.query(Subject).filter(Subject.id == subject_id).first() is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    type_row = crud_assignment_types.get_by_key(db, assignment_type)
    if type_row is None or not type_row.is_active:
        raise HTTPException(
            status_code=400, detail=f"Unknown assignment type '{assignment_type}'"
        )


@router.post("/my-assignments", response_model=StudentAssignmentResponse)
def create_my_assignment(
    request: StudentCreatedAssignmentCreate,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[
        User,
        Depends(require_student_session("/assignments/compose")),
    ],
):
    """Create private one-off work from the current student's view."""
    _validate_student_assignment_definition(
        db, request.subject_id, request.assignment_type
    )
    template = AssignmentTemplate(
        name=request.name,
        subject_id=request.subject_id,
        assignment_type=request.assignment_type,
        description=request.description,
        instructions=request.instructions,
        max_points=request.max_points,
        estimated_duration_minutes=request.estimated_duration_minutes,
        is_library=False,
        is_exportable=False,
        created_by=student.id,
    )
    db.add(template)
    db.flush()
    assignment = StudentAssignment(
        template_id=template.id,
        student_id=student.id,
        assigned_date=request.assigned_date or date.today(),
        due_date=request.due_date,
        assigned_by=student.id,
        is_student_created=True,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/my-assignments/{assignment_id}", response_model=StudentAssignmentResponse)
def update_my_assignment(
    assignment_id: int,
    request: StudentCreatedAssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[
        User,
        Depends(require_student_session("/assignments/student-assignments/{id}")),
    ],
):
    assignment = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.template))
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.student_id != student.id or not assignment.is_student_created:
        raise HTTPException(status_code=403, detail="Access denied")
    if assignment.is_graded or assignment.status in {
        AssignmentStatus.SUBMITTED,
        AssignmentStatus.GRADED,
        AssignmentStatus.EXCUSED,
    }:
        raise HTTPException(
            status_code=409,
            detail="Student-created assignment details are locked after submission",
        )
    if (
        db.query(StudentAssignment)
        .filter(
            StudentAssignment.template_id == assignment.template_id,
            StudentAssignment.id != assignment.id,
        )
        .first()
    ):
        raise HTTPException(
            status_code=409,
            detail="This assignment template is no longer a private one-off",
        )

    data = request.dict(exclude_unset=True)
    subject_id = data.get("subject_id", assignment.template.subject_id)
    assignment_type = data.get("assignment_type", assignment.template.assignment_type)
    _validate_student_assignment_definition(db, subject_id, assignment_type)

    template_fields = {
        "name",
        "subject_id",
        "assignment_type",
        "description",
        "instructions",
        "max_points",
        "estimated_duration_minutes",
    }
    required_fields = {"name", "subject_id", "assignment_type", "max_points"}
    for field in template_fields & data.keys():
        if field in required_fields and data[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        setattr(assignment.template, field, data[field])
    for field in {"assigned_date", "due_date"} & data.keys():
        if field == "assigned_date" and data[field] is None:
            raise HTTPException(status_code=422, detail="assigned_date cannot be null")
        setattr(assignment, field, data[field])
    assignment.update_status()
    db.commit()
    db.refresh(assignment)
    return assignment


def _time_entry_response(entry: AssignmentTimeEntry) -> AssignmentTimeEntryResponse:
    logger_name = "Unknown"
    if entry.logger:
        logger_name = f"{entry.logger.first_name} {entry.logger.last_name}".strip()
    return AssignmentTimeEntryResponse(
        id=entry.id,
        assignment_id=entry.assignment_id,
        logged_by=entry.logged_by,
        logged_by_name=logger_name,
        work_date=entry.work_date,
        minutes=entry.minutes,
        note=entry.note,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _load_time_assignment(
    db: Session, assignment_id: int, auth_user: AuthUser
) -> StudentAssignment:
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if (
        isinstance(auth_user, User)
        and is_student_user(auth_user)
        and assignment.student_id != auth_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    return assignment


def _ensure_student_can_change_time(
    assignment: StudentAssignment, auth_user: AuthUser
) -> None:
    if isinstance(auth_user, User) and is_student_user(auth_user):
        if assignment.is_graded or assignment.status in {
            AssignmentStatus.SUBMITTED,
            AssignmentStatus.GRADED,
            AssignmentStatus.EXCUSED,
        }:
            raise HTTPException(
                status_code=409, detail="Time logs are locked after submission"
            )


def _refresh_time_total(db: Session, assignment: StudentAssignment) -> None:
    assignment.time_spent_minutes = int(
        db.query(func.coalesce(func.sum(AssignmentTimeEntry.minutes), 0))
        .filter(AssignmentTimeEntry.assignment_id == assignment.id)
        .scalar()
        or 0
    )


@router.get(
    "/student-assignments/{assignment_id}/time-entries",
    response_model=List[AssignmentTimeEntryResponse],
)
def get_time_entries(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:read")),
    ],
):
    _load_time_assignment(db, assignment_id, auth_user)
    entries = (
        db.query(AssignmentTimeEntry)
        .options(joinedload(AssignmentTimeEntry.logger))
        .filter(AssignmentTimeEntry.assignment_id == assignment_id)
        .order_by(AssignmentTimeEntry.work_date.desc(), AssignmentTimeEntry.id.desc())
        .all()
    )
    return [_time_entry_response(entry) for entry in entries]


@router.post(
    "/student-assignments/{assignment_id}/time-entries",
    response_model=AssignmentTimeEntryResponse,
)
def create_time_entry(
    assignment_id: int,
    request: AssignmentTimeEntryCreate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:write")),
    ],
):
    assignment = _load_time_assignment(db, assignment_id, auth_user)
    _ensure_student_can_change_time(assignment, auth_user)
    if request.work_date > date.today():
        raise HTTPException(status_code=422, detail="work_date cannot be in the future")
    actor_id = get_user_id_from_auth(auth_user)
    if actor_id is None:
        raise HTTPException(
            status_code=400,
            detail="X-On-Behalf-Of header required for API key access to this endpoint",
        )
    entry = AssignmentTimeEntry(
        assignment_id=assignment.id,
        logged_by=actor_id,
        work_date=request.work_date,
        minutes=request.minutes,
        note=request.note,
    )
    db.add(entry)
    db.flush()
    if assignment.started_date is None or request.work_date < assignment.started_date:
        assignment.started_date = request.work_date
        assignment.update_status()
    _refresh_time_total(db, assignment)
    db.commit()
    entry = (
        db.query(AssignmentTimeEntry)
        .options(joinedload(AssignmentTimeEntry.logger))
        .filter(AssignmentTimeEntry.id == entry.id)
        .one()
    )
    return _time_entry_response(entry)


def _load_time_entry(db: Session, entry_id: int) -> AssignmentTimeEntry:
    entry = (
        db.query(AssignmentTimeEntry)
        .options(
            joinedload(AssignmentTimeEntry.assignment),
            joinedload(AssignmentTimeEntry.logger),
        )
        .filter(AssignmentTimeEntry.id == entry_id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return entry


def _authorize_time_entry_change(
    entry: AssignmentTimeEntry, auth_user: AuthUser
) -> None:
    if isinstance(auth_user, User) and is_student_user(auth_user):
        if (
            entry.assignment.student_id != auth_user.id
            or entry.logged_by != auth_user.id
        ):
            raise HTTPException(status_code=403, detail="Access denied")
        _ensure_student_can_change_time(entry.assignment, auth_user)


@router.put("/time-entries/{entry_id}", response_model=AssignmentTimeEntryResponse)
def update_time_entry(
    entry_id: int,
    request: AssignmentTimeEntryUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:write")),
    ],
):
    entry = _load_time_entry(db, entry_id)
    _authorize_time_entry_change(entry, auth_user)
    data = request.dict(exclude_unset=True)
    if data.get("work_date") and data["work_date"] > date.today():
        raise HTTPException(status_code=422, detail="work_date cannot be in the future")
    for field, value in data.items():
        setattr(entry, field, value)
    db.flush()
    _refresh_time_total(db, entry.assignment)
    db.commit()
    db.refresh(entry)
    return _time_entry_response(entry)


@router.delete("/time-entries/{entry_id}")
def delete_time_entry(
    entry_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:write")),
    ],
):
    entry = _load_time_entry(db, entry_id)
    _authorize_time_entry_change(entry, auth_user)
    assignment = entry.assignment
    db.delete(entry)
    db.flush()
    _refresh_time_total(db, assignment)
    db.commit()
    return {"message": "Time entry deleted successfully"}


# Additional workflow endpoints


@router.get("/my-assignments", response_model=List[StudentAssignmentResponse])
def get_my_assignments(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[
        User,
        Depends(
            require_student_session("/assignments/students/{student_id}/assignments")
        ),
    ],
    status: Optional[str] = Query(None),
    subject_id: Optional[int] = Query(None),
):
    """Get assignments for the current user (student only)."""
    student_id = student.id

    query = (
        db.query(StudentAssignment)
        .options(
            joinedload(StudentAssignment.template).joinedload(
                AssignmentTemplate.subject
            )
        )
        .filter(StudentAssignment.student_id == student_id)
    )

    if subject_id:
        query = query.join(AssignmentTemplate).filter(
            AssignmentTemplate.subject_id == subject_id
        )

    if status:
        try:
            query = query.filter(assignment_status_filter(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status '{status}'")

    assignments = query.order_by(StudentAssignment.due_date.asc().nullslast()).all()
    return assignments


@router.post(
    "/student-assignments/{assignment_id}/start",
    response_model=StudentAssignmentResponse,
)
def start_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:write")),
    ],
):
    """Mark an assignment as started by a student."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if isinstance(auth_user, User) and is_student_user(auth_user):
        if auth_user.id != assignment.student_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif is_admin_user(auth_user):
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

    if assignment.started_date is None:
        assignment.started_date = date.today()
        assignment.update_status()
        db.commit()
        db.refresh(assignment)

    return assignment


@router.post(
    "/student-assignments/{assignment_id}/complete",
    response_model=StudentAssignmentResponse,
)
def complete_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:write")),
    ],
    payload: Optional[StudentAssignmentCompleteRequest] = None,
):
    """Mark an assignment as completed by a student."""
    submission_notes = payload.submission_notes if payload else None
    submission_artifacts = payload.submission_artifacts if payload else None
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if isinstance(auth_user, User) and is_student_user(auth_user):
        if auth_user.id != assignment.student_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif is_admin_user(auth_user):
        student = (
            db.query(User)
            .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

    assignment.completed_date = date.today()
    assignment.submitted_date = date.today()
    if submission_notes:
        assignment.submission_notes = submission_notes
    if submission_artifacts:
        assignment.submission_artifacts = json.dumps(submission_artifacts)

    # Auto-start if not started
    if assignment.started_date is None:
        assignment.started_date = date.today()

    assignment.update_status()
    db.commit()
    db.refresh(assignment)

    return assignment


@router.delete("/student-assignments/{assignment_id}")
def delete_student_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Delete a student assignment (unassign from student)."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    student = (
        db.query(User)
        .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(assignment)
    db.commit()

    logger.info("Deleted student assignment %s", assignment_id)
    return {"message": "Student assignment deleted successfully"}


@router.post(
    "/student-assignments/{assignment_id}/archive",
    response_model=StudentAssignmentResponse,
)
def archive_student_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("assignments:write"))
    ],
):
    """Archive a student assignment."""
    assignment = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.id == assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    student = (
        db.query(User)
        .filter(User.id == assignment.student_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise HTTPException(status_code=403, detail="Access denied")

    # Set status to archived (we need to add this to the enum if it doesn't exist)
    assignment.status = (
        AssignmentStatus.EXCUSED
    )  # Using EXCUSED as archived status for now
    db.commit()
    db.refresh(assignment)

    logger.info("Archived student assignment %s", assignment_id)
    return assignment
