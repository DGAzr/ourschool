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

"""API key Pydantic schemas for API requests and responses."""
from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, validator


class APIKeyCreate(BaseModel):
    """Schema for creating a new API key."""
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name for the API key")
    permissions: List[str] = Field(..., min_items=1, description="List of permissions for this API key")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date")
    
    @validator('name')
    def validate_name(cls, v):
        """Validate the API key name."""
        if not v.strip():
            raise ValueError('Name cannot be empty or only whitespace')
        return v.strip()
    
    @validator('permissions')
    def validate_permissions(cls, v):
        """Validate permissions list."""
        if not v:
            raise ValueError('At least one permission is required')
        
        # Import here to avoid circular imports
        from app.crud.api_keys import AVAILABLE_PERMISSIONS, validate_permissions
        return validate_permissions(v)


class APIKeyUpdate(BaseModel):
    """Schema for updating an API key."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    permissions: Optional[List[str]] = Field(None, min_items=1)
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    
    @validator('name')
    def validate_name(cls, v):
        """Validate the API key name."""
        if v is not None and not v.strip():
            raise ValueError('Name cannot be empty or only whitespace')
        return v.strip() if v else v
    
    @validator('permissions')
    def validate_permissions(cls, v):
        """Validate permissions list."""
        if v is not None:
            if not v:
                raise ValueError('At least one permission is required')
            
            # Import here to avoid circular imports
            from app.crud.api_keys import AVAILABLE_PERMISSIONS, validate_permissions
            return validate_permissions(v)
        return v


class APIKeyResponse(BaseModel):
    """Schema for API key responses (without the secret key)."""
    id: int
    name: str
    key_prefix: str = Field(..., description="First 8 characters of the API key for identification")
    permissions: List[str]
    is_active: bool
    created_by: int
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    is_expired: bool = Field(..., description="Whether the API key has expired")
    is_valid: bool = Field(..., description="Whether the API key is valid (active and not expired)")
    
    class Config:
        from_attributes = True


class APIKeyWithSecret(APIKeyResponse):
    """Schema for API key with the secret (only returned on creation/regeneration)."""
    api_key: str = Field(..., description="The full API key - store this securely!")


class APIKeyStats(BaseModel):
    """Schema for API key usage statistics."""
    id: int
    name: str
    created_at: datetime
    last_used_at: Optional[datetime]
    is_active: bool
    is_expired: bool
    permissions_count: int
    permissions: List[str]


class SystemAPIKeyStats(BaseModel):
    """Schema for system-wide API key statistics."""
    total_keys: int
    active_keys: int
    inactive_keys: int
    expired_keys: int
    recently_used_keys: int = Field(..., description="Keys used in the last 30 days")


class PermissionInfo(BaseModel):
    """Schema for permission information."""
    permission: str
    description: str
    category: str


class AvailablePermissions(BaseModel):
    """Schema for available permissions response."""
    permissions: List[PermissionInfo]
    categories: List[str]


# Permission descriptions for API documentation
PERMISSION_DESCRIPTIONS = {
    "students:read": PermissionInfo(
        permission="students:read",
        description="Read student information and profiles",
        category="Students"
    ),
    "students:write": PermissionInfo(
        permission="students:write", 
        description="Create and update student records",
        category="Students"
    ),
    "attendance:read": PermissionInfo(
        permission="attendance:read",
        description="Read attendance records and statistics",
        category="Attendance"
    ),
    "attendance:write": PermissionInfo(
        permission="attendance:write",
        description="Record and update attendance",
        category="Attendance"
    ),
    "assignments:read": PermissionInfo(
        permission="assignments:read",
        description="Read assignment data and submissions",
        category="Assignments"
    ),
    "assignments:write": PermissionInfo(
        permission="assignments:write",
        description="Create and update assignments",
        category="Assignments"
    ),
    "assignments:grade": PermissionInfo(
        permission="assignments:grade",
        description="Grade student assignments and provide feedback",
        category="Assignments"
    ),
    "points:read": PermissionInfo(
        permission="points:read",
        description="Read student points and transaction history",
        category="Points"
    ),
    "points:write": PermissionInfo(
        permission="points:write",
        description="Add or deduct student points with notes",
        category="Points"
    ),
    "reports:read": PermissionInfo(
        permission="reports:read",
        description="Access reports and analytics",
        category="Reports"
    ),
    "admin:read": PermissionInfo(
        permission="admin:read",
        description="Administrative read access",
        category="Administration"
    ),
    "admin:write": PermissionInfo(
        permission="admin:write",
        description="Administrative write access",
        category="Administration"
    )
}