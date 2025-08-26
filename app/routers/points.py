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

"""
Points system API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser, 
    get_current_user_or_api_key,
    require_admin_or_permission,
    require_student_or_permission,
    require_admin_or_student_self_or_permission,
    can_access_student_data,
    get_auth_context_for_logging,
    get_user_id_from_auth,
    is_admin_user,
    is_student_user
)
from app.core.logging import get_logger
from app.routers.auth import get_current_active_user
from app.models.user import User
from app.enums import UserRole
from app.schemas.points import (
    PointsLedger,
    StudentPoints,
    AdminPointsOverview,
    AdminPointAdjustment,
    PointTransaction,
    PointsSystemStatus,
)
from app.crud import points as points_crud

logger = get_logger("points_api")
router = APIRouter(prefix="/points", tags=["points"])


@router.get("/status", response_model=PointsSystemStatus)
async def get_points_system_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the current status of the points system."""
    enabled = points_crud.is_points_system_enabled(db)
    can_toggle = current_user.role == UserRole.ADMIN
    
    return PointsSystemStatus(enabled=enabled, can_toggle=can_toggle)


@router.post("/toggle")
async def toggle_points_system(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Toggle the points system on/off (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can toggle the points system")
    
    current_status = points_crud.is_points_system_enabled(db)
    new_status = "false" if current_status else "true"
    
    points_crud.update_system_setting(db, "points_system_enabled", new_status)
    
    return {"message": f"Points system {'disabled' if current_status else 'enabled'}", "enabled": not current_status}


@router.get("/my-balance", response_model=StudentPoints)
async def get_my_points_balance(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's points balance (students only)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can view their points balance")
    
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")
    
    student_points = points_crud.get_or_create_student_points(db, current_user.id)
    
    # Add student name for response
    student_points.student_name = f"{current_user.first_name} {current_user.last_name}"
    
    return student_points


@router.get("/my-ledger", response_model=PointsLedger)
async def get_my_points_ledger(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's points ledger with transaction history (students only)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can view their points ledger")
    
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")
    
    student_points, transactions, total_pages = points_crud.get_student_points_ledger(
        db, current_user.id, page, per_page
    )
    
    # Add student name
    student_points.student_name = f"{current_user.first_name} {current_user.last_name}"
    
    # Add admin names to transactions
    for transaction in transactions:
        if transaction.admin_id and transaction.admin:
            transaction.admin_name = f"{transaction.admin.first_name} {transaction.admin.last_name}"
    
    return PointsLedger(
        student_points=student_points,
        transactions=transactions,
        total_pages=total_pages,
        current_page=page
    )


@router.get("/student/{student_id}/balance", response_model=StudentPoints)
async def get_student_points_balance(
    student_id: int,
    auth_user: AuthUser = Depends(require_admin_or_permission("points:read")),
    db: Session = Depends(get_db)
):
    """Get a specific student's points balance (admin users or API keys with points:read permission)."""
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")
    
    # For user sessions, check if they can access this student's data
    if isinstance(auth_user, User) and not can_access_student_data(auth_user, student_id):
        raise HTTPException(status_code=403, detail="Access denied to this student's data")
    
    student_points = points_crud.get_student_points(db, student_id)
    if not student_points:
        # Create a new record if it doesn't exist
        student_points = points_crud.get_or_create_student_points(db, student_id)
        if student_points.student:
            student_points.student_name = f"{student_points.student.first_name} {student_points.student.last_name}"
    
    return student_points


@router.get("/student/{student_id}/ledger", response_model=PointsLedger)
async def get_student_points_ledger(
    student_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    auth_user: AuthUser = Depends(require_admin_or_permission("points:read")),
    db: Session = Depends(get_db)
):
    """Get a specific student's points ledger (admin users or API keys with points:read permission)."""
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")
    
    # For user sessions, check if they can access this student's data
    if isinstance(auth_user, User) and not can_access_student_data(auth_user, student_id):
        raise HTTPException(status_code=403, detail="Access denied to this student's data")
    
    student_points, transactions, total_pages = points_crud.get_student_points_ledger(
        db, student_id, page, per_page
    )
    
    # Add names to response data
    if student_points.student:
        student_points.student_name = f"{student_points.student.first_name} {student_points.student.last_name}"
    
    for transaction in transactions:
        if transaction.admin_id and transaction.admin:
            transaction.admin_name = f"{transaction.admin.first_name} {transaction.admin.last_name}"
        elif not transaction.admin_id:
            # This was likely created by an API key (no admin_id)
            transaction.admin_name = "API Integration"
    
    return PointsLedger(
        student_points=student_points,
        transactions=transactions,
        total_pages=total_pages,
        current_page=page
    )


@router.post("/adjust", response_model=PointTransaction)
async def adjust_student_points(
    adjustment: AdminPointAdjustment,
    auth_user: AuthUser = Depends(require_admin_or_permission("points:write")),
    db: Session = Depends(get_db)
):
    """Manually adjust a student's points (admin users or API keys with points:write permission)."""
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")
    
    # Verify student exists and is a student
    student = db.query(User).filter(
        User.id == adjustment.student_id,
        User.role == UserRole.STUDENT
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get admin ID for transaction (None for API keys)
    admin_id = get_user_id_from_auth(auth_user)
    
    transaction = points_crud.admin_adjust_points(db, adjustment, admin_id)
    
    # Add names to response
    transaction.student_name = f"{student.first_name} {student.last_name}"
    
    # Add admin name if it's a user session
    if admin_id and isinstance(auth_user, User):
        transaction.admin_name = f"{auth_user.first_name} {auth_user.last_name}"
    else:
        # For API keys, use the API key name
        transaction.admin_name = f"API: {auth_user.name}"
    
    # Log the adjustment with context
    auth_context = get_auth_context_for_logging(auth_user)
    logger.info(
        f"Points adjusted for student {student.username} (ID: {student.id}): {adjustment.amount} points",
        extra={
            "student_id": student.id,
            "student_username": student.username,
            "points_amount": adjustment.amount,
            "notes": adjustment.notes,
            "transaction_id": transaction.id,
            **auth_context
        }
    )
    
    return transaction


@router.get("/admin/overview", response_model=AdminPointsOverview)
async def get_admin_points_overview(
    auth_user: AuthUser = Depends(require_admin_or_permission("points:read")),
    db: Session = Depends(get_db)
):
    """Get points system overview for administrators or API keys with points:read permission."""
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")
    
    overview_data = points_crud.get_admin_points_overview(db)
    
    # Add student names to the points records
    for student_points in overview_data["student_points"]:
        if student_points.student:
            student_points.student_name = f"{student_points.student.first_name} {student_points.student.last_name}"
    
    return AdminPointsOverview(**overview_data)