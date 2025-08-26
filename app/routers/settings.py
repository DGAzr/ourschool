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

"""APIs for system settings management."""
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import settings as crud_settings
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.settings import (
    SystemSetting,
    SystemSettingCreate,
    SystemSettingUpdate,
    AttendanceSettings,
    SystemSettingsGroup
)

router = APIRouter()


@router.get("/", response_model=List[SystemSetting])
def get_all_settings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all system settings (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return crud_settings.get_all_settings(db)


@router.get("/grouped", response_model=SystemSettingsGroup)
def get_grouped_settings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get settings organized by category (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get attendance settings
    required_days = crud_settings.get_setting_value(
        db, 
        "attendance.required_days_of_instruction", 
        default_value=180, 
        value_type=int
    )
    
    return SystemSettingsGroup(
        attendance=AttendanceSettings(
            required_days_of_instruction=required_days
        )
    )


@router.get("/{setting_key}", response_model=SystemSetting)
def get_setting(
    setting_key: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific system setting (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    setting = crud_settings.get_setting(db, setting_key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    return setting


@router.post("/", response_model=SystemSetting)
def create_setting(
    setting: SystemSettingCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new system setting (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if setting already exists
    existing = crud_settings.get_setting(db, setting.setting_key)
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Setting '{setting.setting_key}' already exists"
        )
    
    return crud_settings.create_setting(db, setting)


@router.put("/{setting_key}", response_model=SystemSetting)
def update_setting(
    setting_key: str,
    setting_update: SystemSettingUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update an existing system setting (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updated_setting = crud_settings.update_setting(db, setting_key, setting_update)
    if not updated_setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    return updated_setting


@router.put("/attendance/required-days", response_model=SystemSetting)
def update_required_days_of_instruction(
    required_days: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update the required days of instruction setting (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if required_days < 1 or required_days > 365:
        raise HTTPException(
            status_code=400, 
            detail="Required days must be between 1 and 365"
        )
    
    return crud_settings.upsert_setting(
        db,
        "attendance.required_days_of_instruction",
        str(required_days),
        "integer",
        "Required number of instructional days per academic year for attendance calculations"
    )