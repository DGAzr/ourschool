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

"""Authentication APIs."""

import hashlib
import threading
import time
from collections import OrderedDict, deque
from datetime import datetime, timedelta, timezone
import math
from typing import Annotated, Deque, Dict, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.logging import get_logger, log_authentication_event
from app.core.security import get_password_hash, verify_password
from app.core.browser_sessions import (
    resolve_browser_session,
    session_state,
    issue_session_token,
)
from app.models.browser_session import BrowserSession
from app.models.user import User, UserRole
from app.schemas.user import Token, SessionState, SwitchToStudent, ReturnToAdmin

logger = get_logger("auth")

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


# --- Simple in-memory brute-force protection for login --------------------
# Keyed by (client_ip, username); tracks recent failed attempts in a sliding
# window. Suitable for a single-process self-hosted deployment; for multi-worker
# setups put a rate limiter at the reverse proxy.
_LOGIN_WINDOW_SECONDS = 300
_LOGIN_MAX_ATTEMPTS = 8
_LOGIN_MAX_IP_ATTEMPTS = 40
_LOGIN_MAX_TRACKED_KEYS = 4096
_login_failures: Dict[Tuple[str, str], Deque[float]] = OrderedDict()
_login_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _login_key(ip: str, username: str) -> Tuple[str, str]:
    # Bound retained key size even when a request supplies a huge username.
    return (ip, hashlib.sha256(username.casefold().encode()).hexdigest())


def _prune_login_failures(now: float) -> None:
    # Entries are ordered by last failure. Check-only requests allocate nothing.
    while _login_failures:
        key = next(iter(_login_failures))
        attempts = _login_failures[key]
        if attempts and now - attempts[-1] <= _LOGIN_WINDOW_SECONDS:
            break
        del _login_failures[key]


def _check_login_rate_limit(ip: str, username: str) -> None:
    now = time.monotonic()
    with _login_lock:
        _prune_login_failures(now)
        for key, maximum in (
            (_login_key(ip, username), _LOGIN_MAX_ATTEMPTS),
            ((ip, "*"), _LOGIN_MAX_IP_ATTEMPTS),
        ):
            attempts = _login_failures.get(key)
            if not attempts:
                continue
            while attempts and now - attempts[0] > _LOGIN_WINDOW_SECONDS:
                attempts.popleft()
            if len(attempts) >= maximum:
                retry_after = int(_LOGIN_WINDOW_SECONDS - (now - attempts[0]))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed login attempts. Try again later.",
                    headers={"Retry-After": str(max(retry_after, 1))},
                )


def _record_login_failure(ip: str, username: str) -> None:
    now = time.monotonic()
    with _login_lock:
        _prune_login_failures(now)
        for key, maximum in (
            (_login_key(ip, username), _LOGIN_MAX_ATTEMPTS),
            ((ip, "*"), _LOGIN_MAX_IP_ATTEMPTS),
        ):
            attempts = _login_failures.pop(key, deque(maxlen=maximum))
            attempts.append(now)
            _login_failures[key] = attempts
        while len(_login_failures) > _LOGIN_MAX_TRACKED_KEYS:
            _login_failures.pop(next(iter(_login_failures)))


def _clear_login_failures(ip: str, username: str) -> None:
    with _login_lock:
        _login_failures.pop(_login_key(ip, username), None)


def get_user_by_username(db: Session, username: str):
    """Get a user by username."""
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, username: str, password: str):
    """Authenticate a user."""
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
):
    session, user = resolve_browser_session(
        token, db, lock=request.method not in {"GET", "HEAD", "OPTIONS"}
    )
    request.state.browser_session = session
    return user


# Endpoints a user may still reach while a password change is required:
# reading their own profile (to learn about the requirement) and changing
# the password itself.
_PASSWORD_CHANGE_ALLOWED_PATHS = {
    "/api/users/me",
    "/api/users/me/change-password",
    "/api/auth/session",
    "/api/auth/logout",
}


async def get_current_active_user(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if (
        current_user.must_change_password
        and not request.state.browser_session.is_guided
        and request.url.path not in _PASSWORD_CHANGE_ALLOWED_PATHS
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required",
        )
    if (
        request.state.browser_session.is_guided
        and request.url.path == "/api/users/me/change-password"
    ):
        raise HTTPException(
            403, "Password changes are unavailable during a student session."
        )
    return current_user


async def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Require an authenticated admin user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required"
        )
    return current_user


@router.post("/login", response_model=Token)
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    """Login for access token."""
    ip = _client_ip(request)
    _check_login_rate_limit(ip, form_data.username)

    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        _record_login_failure(ip, form_data.username)
        log_authentication_event(
            "login",
            username=form_data.username,
            success=False,
            reason="invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        _record_login_failure(ip, form_data.username)
        log_authentication_event(
            "login", username=form_data.username, success=False, reason="inactive_user"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _clear_login_failures(ip, form_data.username)

    # Installs upgraded from before must_change_password existed: if the
    # well-known seeded credentials still work, force a rotation now.
    if (
        not user.must_change_password
        and user.username == "admin"
        and form_data.password == "admin123"
    ):
        user.must_change_password = True
        db.commit()

    # Opportunistic cleanup keeps expired session secrets out of the database.
    db.query(BrowserSession).filter(
        or_(
            BrowserSession.expires_at <= datetime.now(timezone.utc),
            BrowserSession.revoked_at.isnot(None),
        )
    ).delete(synchronize_session=False)
    session = BrowserSession(
        original_user_id=user.id,
        effective_user_id=user.id,
        original_role=user.role.value,
        generation=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()
    result = issue_session_token(db, session, user)

    log_authentication_event(
        "login", user_id=str(user.id), username=user.username, success=True
    )

    return result


@router.post("/extend-session", response_model=Token)
def extend_session(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return issue_session_token(db, request.state.browser_session, current_user)


@router.get("/session", response_model=SessionState)
def read_session(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return session_state(db, request.state.browser_session, current_user)


@router.post("/switch-to-student", response_model=Token)
def switch_to_student(
    data: SwitchToStudent,
    request: Request,
    current_user: Annotated[User, Depends(get_current_admin_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session = request.state.browser_session
    if session.is_guided:
        raise HTTPException(403, "Return to your account before switching again.")
    student = (
        db.query(User)
        .filter(
            User.id == data.student_id, User.role == UserRole.STUDENT, User.is_active
        )
        .first()
    )
    if not student:
        raise HTTPException(404, "Active student not found.")
    session.effective_user_id = student.id
    session.pin_hash = get_password_hash(data.pin)
    session.pin_failures = 0
    session.pin_blocked_until = None
    session.generation += 1
    result = issue_session_token(db, session, student)
    logger.info(
        "Student session started",
        extra={
            "event": "auth_switch_to_student",
            "administrator_id": current_user.id,
            "student_id": student.id,
        },
    )
    return result


@router.post("/return-to-admin", response_model=Token)
def return_to_admin(
    data: ReturnToAdmin,
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session = request.state.browser_session
    if not session.is_guided:
        raise HTTPException(403, "This is not a parent-started student session.")
    now = datetime.now(timezone.utc)
    if session.pin_blocked_until and session.pin_blocked_until > now:
        retry = max(1, math.ceil((session.pin_blocked_until - now).total_seconds()))
        raise HTTPException(
            429,
            "Too many incorrect PINs. Try again later.",
            headers={"Retry-After": str(retry)},
        )
    if session.pin_blocked_until:
        session.pin_failures = 0
        session.pin_blocked_until = None
    if not verify_password(data.pin, session.pin_hash):
        session.pin_failures += 1
        blocked = session.pin_failures >= 5
        if blocked:
            session.pin_blocked_until = now + timedelta(minutes=5)
        db.commit()
        logger.warning(
            "Student session return failed",
            extra={
                "event": "auth_return_to_admin_failed",
                "administrator_id": session.original_user_id,
                "student_id": current_user.id,
                "reason": "incorrect_pin",
            },
        )
        raise HTTPException(
            429 if blocked else 403,
            (
                "Too many incorrect PINs. Try again in 5 minutes."
                if blocked
                else "Incorrect PIN."
            ),
            headers={"Retry-After": "300"} if blocked else None,
        )
    administrator = db.get(User, session.original_user_id)
    student_id = current_user.id
    session.effective_user_id = administrator.id
    session.pin_hash = None
    session.pin_failures = 0
    session.pin_blocked_until = None
    session.generation += 1
    result = issue_session_token(db, session, administrator)
    logger.info(
        "Student session ended",
        extra={
            "event": "auth_return_to_admin",
            "administrator_id": administrator.id,
            "student_id": student_id,
        },
    )
    return result


@router.post("/logout", status_code=204)
def logout_session(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session = request.state.browser_session
    session.revoked_at = datetime.now(timezone.utc)
    session.pin_hash = None
    session.pin_failures = 0
    session.pin_blocked_until = None
    db.commit()
