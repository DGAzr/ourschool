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

from typing import Annotated, Any, Dict

from fastapi import APIRouter, Depends

from app.core.dual_auth import AuthUser, require_admin_or_permission
from app.utils.performance import (
    find_query_heavy_operations,
    find_slow_operations,
    get_performance_stats,
    log_performance_summary,
    reset_performance_stats,
)

router = APIRouter()


@router.get("/stats", response_model=Dict[str, Dict[str, Any]])
def get_performance_statistics(
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("performance:read"))],
):
    """Get current performance statistics (admin only)."""
    return get_performance_stats()


@router.post("/reset")
def reset_performance_statistics(
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("performance:write"))],
):
    """Reset performance statistics (admin only)."""
    reset_performance_stats()
    return {"message": "Performance statistics reset successfully"}


@router.get("/summary")
def performance_summary(
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("performance:read"))],
):
    """Log performance summary to logs (admin only)."""
    log_performance_summary()
    return {"message": "Performance summary logged"}


@router.get("/slow-operations")
def get_slow_operations(
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("performance:read"))],
    min_avg_time: float = 0.5,
):
    """Get operations that are slower than threshold (admin only)."""
    return find_slow_operations(min_avg_time)


@router.get("/query-heavy-operations")
def get_query_heavy_operations(
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("performance:read"))],
    min_avg_time: float = 0.1,
):
    """Get operations that are slower than threshold (admin only)."""
    return find_query_heavy_operations(min_avg_time)
