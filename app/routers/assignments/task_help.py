"""Task-specific learner help requests."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    require_admin_or_permission,
    require_admin_or_student_self_or_permission,
)
from app.enums import AssignmentStatus, UserRole
from app.models.user import User
from app.models.assignment import (
    AssignmentHelpRequest,
    StudentAssignment,
)
from app.schemas.assignment import (
    AssignmentHelpInput,
    AssignmentHelpResolution,
    AssignmentHelpResponse,
    AssignmentHelpPage,
)

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]
WorkAuth = Annotated[
    AuthUser, Depends(require_admin_or_student_self_or_permission("assignments:write"))
]
TeacherAuth = Annotated[
    AuthUser, Depends(require_admin_or_permission("assignments:write"))
]


def owned_assignment(db, assignment_id, auth, lock=False):
    query = db.query(StudentAssignment).filter(StudentAssignment.id == assignment_id)
    if lock:
        query = query.populate_existing().with_for_update()
    assignment = query.first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if (
        isinstance(auth, User)
        and auth.role == UserRole.STUDENT
        and auth.id != assignment.student_id
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    return assignment


@router.post(
    "/student-assignments/{assignment_id}/help", response_model=AssignmentHelpResponse
)
def ask_for_help(
    assignment_id: int, payload: AssignmentHelpInput, db: Db, auth: WorkAuth
):
    assignment = owned_assignment(db, assignment_id, auth, lock=True)
    if assignment.is_graded or assignment.status == AssignmentStatus.EXCUSED:
        raise HTTPException(status_code=409, detail="This assignment is closed")
    if not payload.note.strip():
        raise HTTPException(status_code=422, detail="Tell your teacher what you need")
    if (
        db.query(AssignmentHelpRequest)
        .filter_by(assignment_id=assignment_id, resolved_at=None)
        .first()
    ):
        raise HTTPException(
            status_code=409,
            detail="Your teacher already has an open help request for this task",
        )
    row = AssignmentHelpRequest(assignment_id=assignment_id, note=payload.note.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/help-requests", response_model=AssignmentHelpPage)
def help_inbox(
    db: Db,
    auth: TeacherAuth,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    rows = (
        db.query(AssignmentHelpRequest)
        .filter(AssignmentHelpRequest.resolved_at.is_(None))
        .options(
            joinedload(AssignmentHelpRequest.assignment).joinedload(
                StudentAssignment.student
            ),
            joinedload(AssignmentHelpRequest.assignment).joinedload(
                StudentAssignment.template
            ),
        )
        .order_by(AssignmentHelpRequest.created_at, AssignmentHelpRequest.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = (
        db.query(AssignmentHelpRequest)
        .filter(AssignmentHelpRequest.resolved_at.is_(None))
        .count()
    )
    result = []
    for row in rows:
        item = AssignmentHelpResponse.model_validate(row)
        student = row.assignment.student
        item.student_name = f"{student.first_name} {student.last_name}"
        item.assignment_name = row.assignment.template.name
        result.append(item)
    return {"items": result, "total": total}


@router.post(
    "/help-requests/{request_id}/resolve", response_model=AssignmentHelpResponse
)
def resolve_help(
    request_id: int, payload: AssignmentHelpResolution, db: Db, auth: TeacherAuth
):
    row = db.query(AssignmentHelpRequest).filter_by(id=request_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Help request not found")
    if row.resolved_at is None:
        row.resolved_at = datetime.now(timezone.utc)
        row.response = payload.response.strip() if payload.response else None
        db.commit()
        db.refresh(row)
    return row
