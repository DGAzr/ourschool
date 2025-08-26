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

"""Performance monitoring APIs."""
from typing import Annotated, Dict, Any

from fastapi import APIRouter, Depends, HTTPException

from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.utils.performance import (
    get_performance_stats,
    reset_performance_stats,
    log_performance_summary,
    find_slow_operations,
    find_query_heavy_operations,
)

router = APIRouter()


@router.get("/stats", response_model=Dict[str, Dict[str, Any]])
def get_performance_statistics(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get current performance statistics (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can access performance statistics"
        )
    
    return get_performance_stats()


@router.post("/reset")
def reset_performance_statistics(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Reset performance statistics (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can reset performance statistics"
        )
    
    reset_performance_stats()
    return {"message": "Performance statistics reset successfully"}


@router.get("/summary")
def performance_summary(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Log performance summary to logs (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can access performance summary"
        )
    
    log_performance_summary()
    return {"message": "Performance summary logged"}


@router.get("/slow-operations")
def get_slow_operations(
    current_user: Annotated[User, Depends(get_current_active_user)],
    min_avg_time: float = 0.5,
):
    """Get operations that are slower than threshold (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can access performance data"
        )
    
    return find_slow_operations(min_avg_time)


@router.get("/query-heavy-operations")
def get_query_heavy_operations(
    current_user: Annotated[User, Depends(get_current_active_user)],
    min_avg_time: float = 0.1,
):
    """Get operations that are slower than threshold (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can access performance data"
        )
    
    return find_query_heavy_operations(min_avg_time)