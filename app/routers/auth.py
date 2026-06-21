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
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Annotated, Deque, Dict, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger, log_authentication_event
from app.core.security import (
    create_access_token,
    decode_token,
    verify_password,
    verify_token,
)
from app.models.user import User, UserRole
from app.schemas.user import Token

logger = get_logger("auth")

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


# --- Simple in-memory brute-force protection for login --------------------
# Keyed by (client_ip, username); tracks recent failed attempts in a sliding
# window. Suitable for a single-process self-hosted deployment; for multi-worker
# setups put a rate limiter at the reverse proxy.
_LOGIN_WINDOW_SECONDS = 300
_LOGIN_MAX_ATTEMPTS = 8
_login_failures: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
_login_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _check_login_rate_limit(ip: str, username: str) -> None:
    """Raise 429 if too many recent failures for this ip/username."""
    key = (ip, username.lower())
    now = time.monotonic()
    with _login_lock:
        attempts = _login_failures[key]
        while attempts and now - attempts[0] > _LOGIN_WINDOW_SECONDS:
            attempts.popleft()
        if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
            retry_after = int(_LOGIN_WINDOW_SECONDS - (now - attempts[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Try again later.",
                headers={"Retry-After": str(max(retry_after, 1))},
            )


def _record_login_failure(ip: str, username: str) -> None:
    key = (ip, username.lower())
    with _login_lock:
        _login_failures[key].append(time.monotonic())


def _clear_login_failures(ip: str, username: str) -> None:
    with _login_lock:
        _login_failures.pop((ip, username.lower()), None)


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


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get the current user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    username = verify_token(token)
    user = get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
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
            reason="invalid_credentials"
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

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    log_authentication_event(
        "login",
        user_id=str(user.id),
        username=user.username,
        success=True
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/extend-session", response_model=Token)
async def extend_session(
    token: Annotated[str, Depends(oauth2_scheme)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Extend the current user's session, bounded by an absolute max age."""
    payload = decode_token(token)
    session_start_ts = payload.get("sst")
    session_start = (
        datetime.fromtimestamp(session_start_ts, tz=timezone.utc)
        if session_start_ts
        else datetime.now(timezone.utc)
    )

    age = datetime.now(timezone.utc) - session_start
    if age > timedelta(minutes=settings.max_session_age_minutes):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has reached its maximum age. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": current_user.username},
        expires_delta=access_token_expires,
        session_start=session_start,
    )
    return {"access_token": access_token, "token_type": "bearer"}