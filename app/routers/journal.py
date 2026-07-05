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

"""Journal entry router."""

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    get_actor_name_from_auth,
    get_user_id_from_auth,
    is_admin_user,
    is_student_user,
    require_admin_or_permission,
    require_user_or_permission,
)
from app.enums import UserRole
from app.models.journal import JournalEntry, JournalReply
from app.models.user import User
from app.schemas.journal import (
    JournalEntryCreate,
    JournalEntryUpdate,
    JournalEntryWithAuthor,
    JournalReplyResponse,
    ReactionsUpdate,
    ReplyCreate,
)
from app.crud import points as points_crud
from app.schemas.points import PointTransactionCreate

router = APIRouter(tags=["journal"])


def _compute_streak(db: Session, student_id: int) -> int:
    rows = (
        db.query(func.date(JournalEntry.entry_date))
        .filter(JournalEntry.student_id == student_id)
        .distinct()
        .order_by(desc(func.date(JournalEntry.entry_date)))
        .all()
    )
    streak = 0
    today = date.today()
    for i, (d,) in enumerate(rows):
        expected = today - timedelta(days=i)
        if d == expected:
            streak += 1
        else:
            break
    return streak


def _entry_to_response(
    entry: JournalEntry, auth_user: AuthUser, db: Session, streak: int = 0
) -> JournalEntryWithAuthor:
    author = db.query(User).filter(User.id == entry.author_id).first()
    student = db.query(User).filter(User.id == entry.student_id).first()

    replies = []
    for r in entry.replies:
        reply_author = db.query(User).filter(User.id == r.author_id).first()
        replies.append(
            JournalReplyResponse(
                id=r.id,
                author_name=(
                    f"{reply_author.first_name} {reply_author.last_name}"
                    if reply_author
                    else "Unknown"
                ),
                author_role=reply_author.role.value if reply_author else "admin",
                text=r.text,
                created_at=r.created_at,
            )
        )

    # is_own_entry: True for a user who authored it; False for admin sessions and keys
    viewer_id = get_user_id_from_auth(auth_user)
    is_own = entry.author_id == viewer_id if viewer_id is not None else False

    return JournalEntryWithAuthor(
        id=entry.id,
        student_id=entry.student_id,
        author_id=entry.author_id,
        title=entry.title,
        content=entry.content,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        mood=entry.mood,
        icon=entry.icon,
        tags=entry.tags or [],
        win=entry.win,
        goals=entry.goals or [],
        reactions=entry.reactions or [],
        needs_response=entry.needs_response,
        points_awarded=entry.points_awarded,
        author_name=f"{author.first_name} {author.last_name}" if author else "Unknown",
        student_name=(
            f"{student.first_name} {student.last_name}" if student else "Unknown"
        ),
        is_own_entry=is_own,
        replies=replies,
        streak=streak,
    )


@router.get("/entries", response_model=List[JournalEntryWithAuthor])
async def get_journal_entries(
    student_id: int = None,
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("journal:read"))] = None,
    db: Session = Depends(get_db),
):
    query = db.query(JournalEntry).options(joinedload(JournalEntry.replies))

    if is_student_user(auth_user):
        query = query.filter(JournalEntry.student_id == auth_user.id)
    elif (is_admin_user(auth_user) or not isinstance(auth_user, User)) and student_id:
        query = query.filter(JournalEntry.student_id == student_id)

    entries = query.order_by(JournalEntry.entry_date.desc()).all()

    streak_cache: dict = {}
    result = []
    for entry in entries:
        if entry.student_id not in streak_cache:
            streak_cache[entry.student_id] = _compute_streak(db, entry.student_id)
        result.append(
            _entry_to_response(entry, auth_user, db, streak_cache[entry.student_id])
        )

    return result


@router.get("/entries/{entry_id}", response_model=JournalEntryWithAuthor)
async def get_journal_entry(
    entry_id: int,
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("journal:read"))],
    db: Session = Depends(get_db),
):
    entry = (
        db.query(JournalEntry)
        .options(joinedload(JournalEntry.replies))
        .filter(JournalEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )

    if isinstance(auth_user, User) and is_student_user(auth_user) and entry.student_id != auth_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own journal entries",
        )

    streak = _compute_streak(db, entry.student_id)
    return _entry_to_response(entry, auth_user, db, streak)


@router.post("/entries", response_model=JournalEntryWithAuthor)
async def create_journal_entry(
    entry_data: JournalEntryCreate,
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("journal:write"))],
    db: Session = Depends(get_db),
):
    if is_student_user(auth_user):
        student_id = auth_user.id
    elif is_admin_user(auth_user):
        if not entry_data.student_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="student_id is required for admin users",
            )
        student_id = entry_data.student_id
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Student not found"
            )
    else:
        # API key: student_id must be provided explicitly
        if not entry_data.student_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="student_id is required for API key access",
            )
        student_id = entry_data.student_id
        student = (
            db.query(User)
            .filter(User.id == student_id, User.role == UserRole.STUDENT)
            .first()
        )
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Student not found"
            )

    author_id = get_user_id_from_auth(auth_user)

    entry = JournalEntry(
        student_id=student_id,
        author_id=author_id,
        title=entry_data.title,
        content=entry_data.content,
        entry_date=entry_data.entry_date or datetime.now(timezone.utc),
        mood=entry_data.mood,
        icon=entry_data.icon,
        tags=entry_data.tags or [],
        win=entry_data.win,
        goals=entry_data.goals or [],
        reactions=[],
        needs_response=True,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Award points to students on their first journal entry of the day
    if is_student_user(auth_user) and points_crud.is_points_system_enabled(db):
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        already_awarded = (
            db.query(JournalEntry)
            .filter(
                JournalEntry.student_id == student_id,
                JournalEntry.points_awarded.isnot(None),
                JournalEntry.created_at >= today_start,
                JournalEntry.id != entry.id,
            )
            .first()
        )
        if not already_awarded:
            setting = points_crud.get_system_setting(db, "journal_points_per_entry")
            amount = int(setting.setting_value) if setting else 5
            txn = PointTransactionCreate(
                student_id=student_id,
                amount=amount,
                transaction_type="journal_submission",
                source_id=entry.id,
                source_description="Journal entry submitted",
            )
            points_crud.create_point_transaction(db, txn)
            entry.points_awarded = amount
            db.commit()
            db.refresh(entry)

    streak = _compute_streak(db, entry.student_id)
    return _entry_to_response(entry, auth_user, db, streak)


@router.put("/entries/{entry_id}", response_model=JournalEntryWithAuthor)
async def update_journal_entry(
    entry_id: int,
    entry_data: JournalEntryUpdate,
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("journal:write"))],
    db: Session = Depends(get_db),
):
    entry = (
        db.query(JournalEntry)
        .options(joinedload(JournalEntry.replies))
        .filter(JournalEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )

    if isinstance(auth_user, User) and is_student_user(auth_user) and entry.author_id != auth_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own journal entries",
        )

    for field in [
        "title",
        "content",
        "entry_date",
        "mood",
        "icon",
        "tags",
        "win",
        "goals",
    ]:
        val = getattr(entry_data, field)
        if val is not None:
            setattr(entry, field, val)

    db.commit()
    db.refresh(entry)
    streak = _compute_streak(db, entry.student_id)
    return _entry_to_response(entry, auth_user, db, streak)


@router.delete("/entries/{entry_id}")
async def delete_journal_entry(
    entry_id: int,
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("journal:write"))],
    db: Session = Depends(get_db),
):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )

    if isinstance(auth_user, User) and is_student_user(auth_user) and entry.author_id != auth_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own journal entries",
        )

    db.delete(entry)
    db.commit()
    return {"message": "Journal entry deleted successfully"}


@router.post("/entries/{entry_id}/reactions", response_model=JournalEntryWithAuthor)
async def set_reactions(
    entry_id: int,
    body: ReactionsUpdate,
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("journal:moderate"))],
    db: Session = Depends(get_db),
):
    entry = (
        db.query(JournalEntry)
        .options(joinedload(JournalEntry.replies))
        .filter(JournalEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )

    entry.reactions = body.reactions
    entry.needs_response = False
    db.commit()
    db.refresh(entry)

    streak = _compute_streak(db, entry.student_id)
    return _entry_to_response(entry, auth_user, db, streak)


@router.post("/entries/{entry_id}/replies", response_model=JournalReplyResponse)
async def add_reply(
    entry_id: int,
    body: ReplyCreate,
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("journal:moderate"))],
    db: Session = Depends(get_db),
):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )

    author_id = get_user_id_from_auth(auth_user)
    reply = JournalReply(
        entry_id=entry_id,
        author_id=author_id,
        text=body.text,
    )
    db.add(reply)
    entry.needs_response = False
    db.commit()
    db.refresh(reply)

    # Build reply author name — works for both User sessions and API keys
    author_name = get_actor_name_from_auth(auth_user)
    # author_role: use the DB user's role if available, else "admin" (keys act as admin)
    if isinstance(auth_user, User):
        author_role = auth_user.role.value
    else:
        author_role = "admin"

    return JournalReplyResponse(
        id=reply.id,
        author_name=author_name,
        author_role=author_role,
        text=reply.text,
        created_at=reply.created_at,
    )


@router.post("/entries/{entry_id}/mark-read", response_model=JournalEntryWithAuthor)
async def mark_entry_read(
    entry_id: int,
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("journal:moderate"))],
    db: Session = Depends(get_db),
):
    entry = (
        db.query(JournalEntry)
        .options(joinedload(JournalEntry.replies))
        .filter(JournalEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )

    if entry.needs_response:
        entry.needs_response = False
        db.commit()
        db.refresh(entry)

    streak = _compute_streak(db, entry.student_id)
    return _entry_to_response(entry, auth_user, db, streak)


@router.delete("/replies/{reply_id}")
async def delete_reply(
    reply_id: int,
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("journal:moderate"))],
    db: Session = Depends(get_db),
):
    reply = db.query(JournalReply).filter(JournalReply.id == reply_id).first()
    if not reply:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found"
        )

    db.delete(reply)
    db.commit()
    return {"message": "Reply deleted successfully"}


@router.get("/composer-data")
async def get_composer_data(
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("journal:read"))],
    db: Session = Depends(get_db),
):
    """Return streak, subjects, and today's points status for the journal composer."""
    from app.models.subject import Subject

    subjects = db.query(Subject).all()
    subject_list = [{"id": s.id, "name": s.name, "color": s.color} for s in subjects]

    viewer_id = get_user_id_from_auth(auth_user)
    streak = (
        _compute_streak(db, viewer_id)
        if is_student_user(auth_user) and viewer_id is not None
        else 0
    )

    points_today = None
    if is_student_user(auth_user) and viewer_id is not None:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        awarded_entry = (
            db.query(JournalEntry)
            .filter(
                JournalEntry.student_id == viewer_id,
                JournalEntry.points_awarded.isnot(None),
                JournalEntry.created_at >= today_start,
            )
            .first()
        )
        if awarded_entry:
            points_today = awarded_entry.points_awarded

    points_per_entry = None
    if points_crud.is_points_system_enabled(db):
        setting = points_crud.get_system_setting(db, "journal_points_per_entry")
        points_per_entry = int(setting.setting_value) if setting else 5

    return {
        "streak": streak,
        "subjects": subject_list,
        "points_today": points_today,
        "points_per_entry": points_per_entry,
    }


@router.get("/students", response_model=List[dict])
async def get_students_for_journal(
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("journal:read"))],
    db: Session = Depends(get_db),
):
    students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    return [
        {"id": s.id, "name": f"{s.first_name} {s.last_name}", "email": s.email}
        for s in students
    ]
