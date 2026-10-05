"""Shared browser-session validation for bearer-only and dual authentication."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, decode_token
from app.crud import settings as crud_settings
from app.models.browser_session import BrowserSession
from app.models.user import User, UserRole
from app.schemas.user import SessionState, User as UserSchema


def resolve_browser_session(token: str, db: Session, *, lock: bool = False):
    """Reject legacy/stale credentials; resolve identity exclusively on the server.

    Mutating requests lock the session until their transaction ends, so a write
    cannot authenticate against a generation concurrently being replaced.
    """
    payload = decode_token(token)
    if not isinstance(payload.get("sid"), str) or type(payload.get("gen")) is not int:
        raise HTTPException(401, "Your session has expired. Please log in again.")
    query = db.query(BrowserSession).filter(BrowserSession.id == payload.get("sid"))
    if lock:
        query = query.with_for_update()
    session = query.populate_existing().first()
    now = datetime.now(timezone.utc)
    if not session or session.revoked_at or session.generation != payload.get("gen"):
        raise HTTPException(401, "Your session has expired. Please log in again.")
    if session.expires_at and session.expires_at <= now:
        terminate_browser_session(db, session)
        raise HTTPException(401, "Your session has expired. Please log in again.")
    original = db.get(User, session.original_user_id)
    effective = db.get(User, session.effective_user_id)
    if (
        not original
        or not effective
        or not original.is_active
        or not effective.is_active
        or original.role.value != session.original_role
        or effective.external_id != payload.get("sub")
        or (
            session.is_guided
            and (
                original.role != UserRole.ADMIN
                or original.must_change_password
                or effective.role != UserRole.STUDENT
                or not session.pin_hash
            )
        )
    ):
        terminate_browser_session(db, session)
        raise HTTPException(401, "Your account has changed. Please log in again.")
    return session, effective


def session_state(db: Session, session: BrowserSession, user: User) -> SessionState:
    original = db.get(User, session.original_user_id)
    return SessionState(
        user=UserSchema.model_validate(user),
        is_guided=session.is_guided,
        return_account_name=(
            f"{original.first_name} {original.last_name}".strip()
            if session.is_guided
            else None
        ),
        generation=session.generation,
        expires_at=session.expires_at,
    )


def issue_session_token(db: Session, session: BrowserSession, user: User):
    minutes = crud_settings.get_session_timeout_minutes(
        db, default_value=settings.access_token_expire_minutes
    )
    lifetime = timedelta(minutes=minutes) if minutes > 0 else None
    session.expires_at = datetime.now(timezone.utc) + lifetime if lifetime else None
    token = create_access_token(
        {"sub": user.external_id, "sid": session.id, "gen": session.generation},
        expires_delta=lifetime,
        never_expires=minutes == 0,
        session_start=session.started_at,
    )
    # Freeze the snapshot while the session lock is held. After commit, another
    # request may rotate this row before SQLAlchemy reloads expired attributes.
    snapshot = session_state(db, session, user)
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "session": snapshot,
    }


def revoke_browser_sessions(db: Session, user_id: int | None = None):
    """Revoke credentials and erase PIN secrets within the caller's transaction."""
    query = db.query(BrowserSession)
    if user_id is not None:
        query = query.filter(
            or_(
                BrowserSession.original_user_id == user_id,
                BrowserSession.effective_user_id == user_id,
            )
        )
    query.update(
        {
            BrowserSession.revoked_at: datetime.now(timezone.utc),
            BrowserSession.pin_hash: None,
            BrowserSession.pin_failures: 0,
            BrowserSession.pin_blocked_until: None,
        },
        synchronize_session="fetch",
    )


def terminate_browser_session(db: Session, session: BrowserSession):
    # The generation predicate prevents a stale validator from revoking newer
    # credentials if a transition completed between its read and this write.
    db.query(BrowserSession).filter(
        BrowserSession.id == session.id,
        BrowserSession.generation == session.generation,
    ).update(
        {
            BrowserSession.revoked_at: datetime.now(timezone.utc),
            BrowserSession.pin_hash: None,
            BrowserSession.pin_failures: 0,
            BrowserSession.pin_blocked_until: None,
        },
        synchronize_session="fetch",
    )
    db.commit()
