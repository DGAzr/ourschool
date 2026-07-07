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

"""API key authentication utilities."""

from datetime import datetime, timezone
from typing import List, Optional, Union

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_api_key
from app.models.api_key import APIKey
from app.models.user import User, UserRole


class APIKeyUser:
    """Represents an API key with permissions for authentication.

    Design rule: the API-key surface is admin-scoped automation. A key may
    read/write any student's data subject to its permissions and attribute
    writes to an admin via X-On-Behalf-Of (admin-only, fail-closed), but it
    has no student identity — current-user ("my") endpoints reject keys, and
    nothing on the API surface can author content as a student.
    """

    def __init__(
        self,
        api_key_id: int,
        permissions: List[str],
        name: str = "API Key",
        acting_user_id: Optional[int] = None,
        acting_user_name: Optional[str] = None,
    ):
        self.api_key_id = api_key_id
        self.permissions = permissions
        self.role = "api_key"  # Special role for API keys
        self.name = name
        # Optional "acting on behalf of" admin, resolved from the
        # X-On-Behalf-Of header so writes can be attributed to a real user.
        self.acting_user_id = acting_user_id
        self.acting_user_name = acting_user_name

    def has_permission(self, permission: str) -> bool:
        """Check if this API key has a specific permission."""
        return permission in self.permissions

    def has_any_permission(self, permissions: List[str]) -> bool:
        """Check if this API key has any of the specified permissions."""
        return any(self.has_permission(perm) for perm in permissions)

    def has_all_permissions(self, permissions: List[str]) -> bool:
        """Check if this API key has all of the specified permissions."""
        return all(self.has_permission(perm) for perm in permissions)


def _resolve_acting_admin(db: Session, raw: str) -> User:
    """Resolve an X-On-Behalf-Of value to an active admin user.

    Accepts a numeric user ID or a username (numeric values are tried as an ID
    first, then as a username). Fail-closed: an unknown, inactive, or non-admin
    value raises 400 so the request is rejected before any mutation.
    """
    from app.routers.auth import get_user_by_username

    ident = raw.strip()
    user: Optional[User] = None
    if ident.isdigit():
        user = db.query(User).filter(User.id == int(ident)).first()
    if user is None:
        user = get_user_by_username(db, ident)

    if user is None or not user.is_active or user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-On-Behalf-Of must reference an active admin user",
        )
    return user


async def get_api_key_auth(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_on_behalf_of: Optional[str] = Header(None, alias="X-On-Behalf-Of"),
    db: Session = Depends(get_db),
) -> Optional[APIKeyUser]:
    """Authenticate via API key. Returns None if no API key provided."""
    if not x_api_key:
        return None

    if not x_api_key.startswith("os_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract prefix for efficient lookup
    prefix = x_api_key[:8]

    # Find API key by prefix
    api_key = (
        db.query(APIKey).filter(APIKey.key_prefix == prefix, APIKey.is_active).first()
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify the full API key
    if not verify_api_key(x_api_key, api_key.key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if API key is expired
    if api_key.is_expired:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last used timestamp
    api_key.last_used_at = datetime.now(timezone.utc)
    db.commit()

    # Optionally attribute writes to a real admin (fail-closed if invalid).
    acting_user_id = None
    acting_user_name = None
    if x_on_behalf_of:
        acting_user = _resolve_acting_admin(db, x_on_behalf_of)
        acting_user_id = acting_user.id
        acting_user_name = f"{acting_user.first_name} {acting_user.last_name}".strip()

    return APIKeyUser(
        api_key_id=api_key.id,
        permissions=api_key.permissions,
        name=api_key.name,
        acting_user_id=acting_user_id,
        acting_user_name=acting_user_name,
    )


async def require_api_key_auth(
    api_key_user: Optional[APIKeyUser] = Depends(get_api_key_auth),
) -> APIKeyUser:
    """Require API key authentication."""
    if not api_key_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return api_key_user


def require_permission(permission: str):
    """Dependency factory to require a specific permission."""

    async def permission_dependency(
        api_key_user: APIKeyUser = Depends(require_api_key_auth),
    ) -> APIKeyUser:
        if not api_key_user.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        return api_key_user

    return permission_dependency


def require_any_permission(permissions: List[str]):
    """Dependency factory to require any of the specified permissions."""

    async def permission_dependency(
        api_key_user: APIKeyUser = Depends(require_api_key_auth),
    ) -> APIKeyUser:
        if not api_key_user.has_any_permission(permissions):
            perms_str = "', '".join(permissions)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: '{perms_str}'",
            )
        return api_key_user

    return permission_dependency


def require_all_permissions(permissions: List[str]):
    """Dependency factory to require all of the specified permissions."""

    async def permission_dependency(
        api_key_user: APIKeyUser = Depends(require_api_key_auth),
    ) -> APIKeyUser:
        if not api_key_user.has_all_permissions(permissions):
            perms_str = "', '".join(permissions)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"All of these permissions required: '{perms_str}'",
            )
        return api_key_user

    return permission_dependency


# Type alias for authentication that accepts either User or APIKeyUser
AuthUser = Union[User, APIKeyUser]
