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

"""Dual authentication system supporting both User sessions and API keys."""
from typing import List, Optional, Union

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.api_auth import APIKeyUser, get_api_key_auth
from app.core.database import get_db
from app.enums import UserRole
from app.models.user import User
from app.routers.auth import get_current_active_user


# Type alias for dual authentication
AuthUser = Union[User, APIKeyUser]


async def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Get current user without raising an exception if not authenticated.
    Returns None if no valid Bearer token is provided.
    """
    from fastapi.security.utils import get_authorization_scheme_param
    from app.routers.auth import get_user_by_username
    from app.core.security import verify_token
    
    # Extract authorization header
    authorization = request.headers.get("Authorization")
    if not authorization:
        return None
    
    scheme, token = get_authorization_scheme_param(authorization)
    if scheme.lower() != "bearer":
        return None
    
    try:
        username = verify_token(token)
        if username:
            user = get_user_by_username(db, username)
            if user and user.is_active:
                return user
    except:
        pass
    
    return None


async def get_current_user_or_api_key(
    current_user: Optional[User] = Depends(get_current_user_optional),
    api_key_user: Optional[APIKeyUser] = Depends(get_api_key_auth),
) -> AuthUser:
    """
    Get either the current authenticated user or API key user.
    Prioritizes user authentication over API key authentication.
    """
    if current_user:
        return current_user
    elif api_key_user:
        return api_key_user
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required (user session or API key)",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_admin_or_permission(permission: str):
    """
    Dependency factory that requires either:
    - Admin user role (for user sessions)
    - Specific permission (for API keys)
    """
    async def auth_dependency(
        auth_user: AuthUser = Depends(get_current_user_or_api_key)
    ) -> AuthUser:
        if isinstance(auth_user, User):
            # User session - check admin role
            if auth_user.role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin role required"
                )
        elif isinstance(auth_user, APIKeyUser):
            # API key - check permission
            if not auth_user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )
        
        return auth_user
    
    return auth_dependency


def require_student_or_permission(permission: str):
    """
    Dependency factory that requires either:
    - Student user role accessing their own data (for user sessions)
    - Specific permission (for API keys)
    """
    async def auth_dependency(
        auth_user: AuthUser = Depends(get_current_user_or_api_key)
    ) -> AuthUser:
        if isinstance(auth_user, User):
            # User session - must be student (additional checks needed in endpoint)
            if auth_user.role != UserRole.STUDENT:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Student role required or admin access needed"
                )
        elif isinstance(auth_user, APIKeyUser):
            # API key - check permission
            if not auth_user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )
        
        return auth_user
    
    return auth_dependency


def require_admin_or_student_self_or_permission(permission: str):
    """
    Dependency factory that allows:
    - Admin users (full access)
    - Student users (own data only - additional checks in endpoint)
    - API keys with specific permission
    """
    async def auth_dependency(
        auth_user: AuthUser = Depends(get_current_user_or_api_key)
    ) -> AuthUser:
        if isinstance(auth_user, User):
            # User session - allow admin or student (self-access checked in endpoint)
            if auth_user.role not in [UserRole.ADMIN, UserRole.STUDENT]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin or student role required"
                )
        elif isinstance(auth_user, APIKeyUser):
            # API key - check permission
            if not auth_user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )
        
        return auth_user
    
    return auth_dependency


def require_any_permission(permissions: List[str]):
    """
    Dependency factory that requires any of the specified permissions for API keys,
    or admin role for user sessions.
    """
    async def auth_dependency(
        auth_user: AuthUser = Depends(get_current_user_or_api_key)
    ) -> AuthUser:
        if isinstance(auth_user, User):
            # User session - check admin role
            if auth_user.role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin role required"
                )
        elif isinstance(auth_user, APIKeyUser):
            # API key - check any permission
            if not auth_user.has_any_permission(permissions):
                perms_str = "', '".join(permissions)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"One of these permissions required: '{perms_str}'"
                )
        
        return auth_user
    
    return auth_dependency


def get_user_id_from_auth(auth_user: AuthUser) -> Optional[int]:
    """Extract user ID from auth user (None for API keys)."""
    if isinstance(auth_user, User):
        return auth_user.id
    return None


def is_admin_user(auth_user: AuthUser) -> bool:
    """Check if the auth user is an admin."""
    if isinstance(auth_user, User):
        return auth_user.role == UserRole.ADMIN
    # API keys are not considered admin users
    return False


def is_student_user(auth_user: AuthUser) -> bool:
    """Check if the auth user is a student."""
    if isinstance(auth_user, User):
        return auth_user.role == UserRole.STUDENT
    # API keys are not considered student users
    return False


def can_access_student_data(auth_user: AuthUser, student_id: int) -> bool:
    """
    Check if the auth user can access data for a specific student.
    - Admin users: can access any student
    - Student users: can only access their own data
    - API keys: permission-based access (checked elsewhere)
    """
    if isinstance(auth_user, User):
        if auth_user.role == UserRole.ADMIN:
            return True
        elif auth_user.role == UserRole.STUDENT:
            return auth_user.id == student_id
    elif isinstance(auth_user, APIKeyUser):
        # For API keys, access is controlled by permissions
        return True
    
    return False


def get_auth_context_for_logging(auth_user: AuthUser) -> dict:
    """Get context information for logging."""
    if isinstance(auth_user, User):
        return {
            "auth_type": "user_session",
            "user_id": auth_user.id,
            "username": auth_user.username,
            "role": auth_user.role.value
        }
    elif isinstance(auth_user, APIKeyUser):
        return {
            "auth_type": "api_key",
            "api_key_id": auth_user.api_key_id,
            "api_key_name": auth_user.name,
            "permissions": auth_user.permissions
        }
    else:
        return {"auth_type": "unknown"}