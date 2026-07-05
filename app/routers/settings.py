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

import json
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dual_auth import AuthUser, require_admin_or_permission
from app.crud import settings as crud_settings
from app.schemas.settings import (
    AttendanceSettings,
    GradeBand,
    GradeScaleUpdate,
    GradingSettings,
    SystemSetting,
    SystemSettingCreate,
    SystemSettingUpdate,
    SystemSettingsGroup,
)

router = APIRouter()


@router.get("/", response_model=List[SystemSetting])
def get_all_settings(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:read"))],
):
    """Get all system settings (admin only)."""
    return crud_settings.get_all_settings(db)


@router.get("/grouped", response_model=SystemSettingsGroup)
def get_grouped_settings(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:read"))],
):
    """Get settings organized by category (admin only)."""
    required_days = crud_settings.get_setting_value(
        db, "attendance.required_days_of_instruction", default_value=180, value_type=int
    )
    skip_weekends = crud_settings.get_setting_value(
        db, "attendance.skip_weekends", default_value=True, value_type=bool
    )
    count_excused = crud_settings.get_setting_value(
        db, "attendance.count_excused", default_value=True, value_type=bool
    )

    raw_scale = crud_settings.get_grade_scale(db)
    grade_bands = [
        GradeBand(letter=letter, min_percent=min_pct) for letter, min_pct in raw_scale
    ]

    return SystemSettingsGroup(
        attendance=AttendanceSettings(
            required_days_of_instruction=required_days,
            skip_weekends=skip_weekends,
            count_excused=count_excused,
        ),
        grading=GradingSettings(scale=grade_bands),
    )


@router.get("/{setting_key}", response_model=SystemSetting)
def get_setting(
    setting_key: str,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:read"))],
):
    """Get a specific system setting (admin only)."""
    setting = crud_settings.get_setting(db, setting_key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    return setting


@router.post("/", response_model=SystemSetting)
def create_setting(
    setting: SystemSettingCreate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:write"))],
):
    """Create a new system setting (admin only)."""
    # Check if setting already exists
    existing = crud_settings.get_setting(db, setting.setting_key)
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Setting '{setting.setting_key}' already exists"
        )

    return crud_settings.create_setting(db, setting)


@router.put("/{setting_key}", response_model=SystemSetting)
def update_setting(
    setting_key: str,
    setting_update: SystemSettingUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:write"))],
):
    """Update an existing system setting (admin only)."""
    updated_setting = crud_settings.update_setting(db, setting_key, setting_update)
    if not updated_setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    return updated_setting


@router.put("/grading/scale", response_model=GradingSettings)
def update_grade_scale(
    scale_update: GradeScaleUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:write"))],
):
    """Update the letter-grade threshold scale (admin only)."""
    if not scale_update.scale:
        raise HTTPException(status_code=400, detail="Scale must have at least one band")

    payload = json.dumps(
        [{"letter": b.letter, "min_percent": b.min_percent} for b in scale_update.scale]
    )
    crud_settings.upsert_setting(
        db,
        "grading.scale",
        payload,
        "json",
        "Letter-grade threshold bands (JSON array of {letter, min_percent})",
    )
    return GradingSettings(scale=scale_update.scale)


@router.put("/attendance/required-days", response_model=SystemSetting)
def update_required_days_of_instruction(
    required_days: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:write"))],
):
    """Update the required days of instruction setting (admin only)."""
    if required_days < 1 or required_days > 365:
        raise HTTPException(
            status_code=400, detail="Required days must be between 1 and 365"
        )

    return crud_settings.upsert_setting(
        db,
        "attendance.required_days_of_instruction",
        str(required_days),
        "integer",
        "Required number of instructional days per academic year for attendance calculations",
    )


@router.put("/attendance/skip-weekends", response_model=SystemSetting)
def update_skip_weekends(
    skip_weekends: bool,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:write"))],
):
    """Update whether weekends are excluded from instructional day counts (admin only)."""
    return crud_settings.upsert_setting(
        db,
        "attendance.skip_weekends",
        str(skip_weekends).lower(),
        "boolean",
        "Exclude Saturdays and Sundays from instructional day counts",
    )


@router.put("/attendance/count-excused", response_model=SystemSetting)
def update_count_excused(
    count_excused: bool,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("settings:write"))],
):
    """Update whether excused absences count toward required instruction days (admin only)."""
    return crud_settings.upsert_setting(
        db,
        "attendance.count_excused",
        str(count_excused).lower(),
        "boolean",
        "Count excused absences as instructional days toward the required-days total",
    )
