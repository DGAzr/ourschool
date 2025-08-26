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

"""Permission checking utilities for backup module."""
from typing import Annotated

from fastapi import Depends, HTTPException

from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user


def require_admin_for_backup(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require admin role for backup operations.
    
    Args:
        current_user: The current authenticated user
        
    Returns:
        The user if they are an admin
        
    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="Only administrators can perform backup operations"
        )
    return current_user