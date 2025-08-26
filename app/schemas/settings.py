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

"""System settings schemas."""
from typing import List, Optional
from pydantic import BaseModel


class SystemSettingBase(BaseModel):
    """Base schema for system settings."""
    setting_key: str
    setting_value: str
    setting_type: str  # 'boolean', 'string', 'integer', 'float', 'json'
    description: Optional[str] = None
    is_active: bool = True


class SystemSettingCreate(SystemSettingBase):
    """Schema for creating system settings."""
    pass


class SystemSettingUpdate(BaseModel):
    """Schema for updating system settings."""
    setting_value: str
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SystemSetting(SystemSettingBase):
    """Schema for system settings with all fields."""
    id: int
    
    class Config:
        orm_mode = True


class AttendanceSettings(BaseModel):
    """Schema for attendance-specific settings."""
    required_days_of_instruction: int
    
    
class SystemSettingsGroup(BaseModel):
    """Schema for grouped system settings."""
    attendance: AttendanceSettings