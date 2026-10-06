"""Teacher-only operational dashboard reads, bounded independently by section."""

from datetime import date
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.auth import get_current_admin_user
from app.models.user import User
from app.crud import teacher_dashboard as reads

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]
# Cross-module content requires an administrator session, rather than granting
# a reports-only API key access to journals and requests.
Teacher = Annotated[User, Depends(get_current_admin_user)]
Scope = Literal["today", "week"]


@router.get("/schedule")
def schedule(
    db: Db,
    auth: Teacher,
    today: date,
    scope: Scope = "today",
    student_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    return reads.schedule(db, today, scope, student_id, offset, limit)


@router.get("/preparation")
def preparation(
    db: Db,
    auth: Teacher,
    today: date,
    student_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
):
    return reads.schedule(
        db, today, "today", student_id, offset, limit, preparation=True
    )


@router.get("/inbox")
def inbox(
    db: Db,
    auth: Teacher,
    student_id: int | None = None,
    category: Literal["all", "journals", "approvals", "pickups", "help"] = "all",
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    return reads.inbox(db, student_id, category, offset, limit)


@router.get("/students")
def students(
    db: Db,
    auth: Teacher,
    today: date,
    scope: Scope = "today",
    student_id: int | None = None,
    all_work: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
):
    return reads.student_overview(db, today, scope, student_id, all_work, offset, limit)


@router.get("/activity")
def activity(
    db: Db,
    auth: Teacher,
    student_id: int | None = None,
    limit: int = Query(5, ge=1, le=50),
):
    return reads.recent_activity(db, student_id, limit)


@router.get("/roster")
def roster(
    db: Db,
    auth: Teacher,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    query = reads.roster(db)
    total = query.count()
    offset = min(offset, max(0, (total - 1) // limit * limit))
    rows = (
        query.order_by(User.first_name, User.last_name, User.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return dict(
        items=[dict(row._mapping) for row in rows],
        total=total,
        offset=offset,
        has_more=offset + len(rows) < total,
    )
