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

"""CRUD operations for system settings."""
import json
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from app.models.points import SystemSettings
from app.schemas.settings import SystemSettingCreate, SystemSettingUpdate
from app.enums import AssignmentType


# Key for the per-assignment-type grade weight multipliers (JSON object).
ASSIGNMENT_TYPE_WEIGHTS_KEY = "grades.type_weights"

# Default weight for every assignment type. Neutral (1.0) means grades behave
# as plain points-weighting until an admin chooses to weight a type differently.
DEFAULT_ASSIGNMENT_TYPE_WEIGHTS: Dict[str, float] = {
    t.value: 1.0 for t in AssignmentType
}


def get_setting(db: Session, setting_key: str) -> Optional[SystemSettings]:
    """Get a single system setting by key."""
    return db.query(SystemSettings).filter(
        SystemSettings.setting_key == setting_key,
        SystemSettings.is_active == True
    ).first()


def get_all_settings(db: Session) -> List[SystemSettings]:
    """Get all active system settings."""
    return db.query(SystemSettings).filter(SystemSettings.is_active == True).all()


def get_settings_by_prefix(db: Session, key_prefix: str) -> List[SystemSettings]:
    """Get all settings with a specific key prefix (e.g., 'attendance.')."""
    return db.query(SystemSettings).filter(
        SystemSettings.setting_key.like(f"{key_prefix}%"),
        SystemSettings.is_active == True
    ).all()


def create_setting(db: Session, setting: SystemSettingCreate) -> SystemSettings:
    """Create a new system setting."""
    db_setting = SystemSettings(**setting.dict())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting


def update_setting(db: Session, setting_key: str, setting_update: SystemSettingUpdate) -> Optional[SystemSettings]:
    """Update an existing system setting."""
    db_setting = get_setting(db, setting_key)
    if not db_setting:
        return None
    
    update_data = setting_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_setting, field, value)
    
    db.commit()
    db.refresh(db_setting)
    return db_setting


def upsert_setting(db: Session, setting_key: str, value: str, setting_type: str, description: str = None) -> SystemSettings:
    """Create or update a setting."""
    existing = get_setting(db, setting_key)
    if existing:
        existing.setting_value = value
        if description:
            existing.description = description
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_setting = SystemSettings(
            setting_key=setting_key,
            setting_value=value,
            setting_type=setting_type,
            description=description
        )
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)
        return new_setting


def get_setting_value(db: Session, setting_key: str, default_value: Any = None, value_type: type = str) -> Any:
    """Get a setting value with type conversion and default fallback."""
    setting = get_setting(db, setting_key)
    if not setting:
        return default_value
    
    try:
        if value_type == bool:
            return setting.setting_value.lower() in ('true', '1', 'yes', 'on')
        elif value_type == int:
            return int(setting.setting_value)
        elif value_type == float:
            return float(setting.setting_value)
        else:
            return setting.setting_value
    except (ValueError, AttributeError):
        return default_value


def get_assignment_type_weights(db: Session) -> Dict[str, float]:
    """Return the per-assignment-type grade weight multipliers.

    Falls back to neutral (all 1.0) when the setting is missing or malformed,
    and fills in 1.0 for any assignment type not present in the stored value.
    """
    weights = dict(DEFAULT_ASSIGNMENT_TYPE_WEIGHTS)
    setting = get_setting(db, ASSIGNMENT_TYPE_WEIGHTS_KEY)
    if not setting:
        return weights

    try:
        stored = json.loads(setting.setting_value)
    except (ValueError, TypeError):
        return weights

    if isinstance(stored, dict):
        for key, value in stored.items():
            try:
                weights[key] = float(value)
            except (TypeError, ValueError):
                continue
    return weights


def initialize_default_settings(db: Session) -> None:
    """Initialize default system settings if they don't exist."""
    defaults = [
        {
            "setting_key": "attendance.required_days_of_instruction",
            "setting_value": "180",
            "setting_type": "integer",
            "description": "Required number of instructional days per academic year for attendance calculations"
        },
        {
            "setting_key": "points.system_enabled",
            "setting_value": "true",
            "setting_type": "boolean",
            "description": "Enable or disable the student points system"
        },
        {
            "setting_key": ASSIGNMENT_TYPE_WEIGHTS_KEY,
            "setting_value": json.dumps(DEFAULT_ASSIGNMENT_TYPE_WEIGHTS),
            "setting_type": "json",
            "description": "Per-assignment-type grade weight multipliers. Neutral (1.0) behaves as plain points-weighting."
        }
    ]

    for default in defaults:
        existing = get_setting(db, default["setting_key"])
        if not existing:
            create_setting(db, SystemSettingCreate(**default))