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

"""Security utilities."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt truncates at 72 bytes.  passlib silently did the same; we reproduce
# that behaviour explicitly so existing hashes (produced by passlib) continue
# to verify and long passwords don't raise ValueError on bcrypt 5.x+.
_BCRYPT_MAX_BYTES = 72


def _normalize(secret: str) -> bytes:
    """Encode *secret* to UTF-8 and truncate to the bcrypt 72-byte limit."""
    return secret.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(_normalize(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of *password* as a str."""
    return bcrypt.hashpw(_normalize(password), bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    session_start: Optional[datetime] = None,
):
    """Create an access token.

    ``session_start`` records when the underlying session originally began so
    that ``/extend-session`` can enforce an absolute maximum session lifetime
    regardless of how many times the token is renewed.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    started = session_start or now
    to_encode.update({"exp": expire, "iat": now, "sst": int(started.timestamp())})
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify a token, returning the full payload."""
    try:
        return jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def verify_token(token: str):
    """Verify a token and return the subject (username)."""
    payload = decode_token(token)
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return username


def generate_api_key() -> Tuple[str, str]:
    """Generate a new API key and return (full_key, prefix)."""
    # Generate a secure random string
    random_part = secrets.token_urlsafe(32)
    
    # Create the full API key with prefix
    full_key = f"os_{random_part}"
    
    # Extract prefix (first 8 characters)
    prefix = full_key[:8]
    
    return full_key, prefix


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure storage."""
    return bcrypt.hashpw(_normalize(api_key), bcrypt.gensalt()).decode("utf-8")


def verify_api_key(api_key: str, hashed_key: str) -> bool:
    """Verify an API key against its hash."""
    try:
        return bcrypt.checkpw(_normalize(api_key), hashed_key.encode("utf-8"))
    except (ValueError, TypeError):
        return False