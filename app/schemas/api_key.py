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
from typing import Optional, List

from pydantic import BaseModel, Field, validator


class APIKeyCreate(BaseModel):
    """Schema for creating a new API key."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable name for the API key",
    )
    permissions: List[str] = Field(
        ..., min_items=1, description="List of permissions for this API key"
    )
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date")

    @validator("name")
    def validate_name(cls, v):
        """Validate the API key name."""
        if not v.strip():
            raise ValueError("Name cannot be empty or only whitespace")
        return v.strip()

    @validator("permissions")
    def validate_permissions(cls, v):
        """Validate permissions list."""
        if not v:
            raise ValueError("At least one permission is required")

        # Import here to avoid circular imports
        from app.crud.api_keys import validate_permissions

        return validate_permissions(v)


class APIKeyUpdate(BaseModel):
    """Schema for updating an API key."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    permissions: Optional[List[str]] = Field(None, min_items=1)
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None

    @validator("name")
    def validate_name(cls, v):
        """Validate the API key name."""
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty or only whitespace")
        return v.strip() if v else v

    @validator("permissions")
    def validate_permissions(cls, v):
        """Validate permissions list."""
        if v is not None:
            if not v:
                raise ValueError("At least one permission is required")

            # Import here to avoid circular imports
            from app.crud.api_keys import validate_permissions

            return validate_permissions(v)
        return v


class APIKeyResponse(BaseModel):
    """Schema for API key responses (without the secret key)."""

    id: int
    name: str
    key_prefix: str = Field(
        ..., description="First 8 characters of the API key for identification"
    )
    permissions: List[str]
    is_active: bool
    created_by: int
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    is_expired: bool = Field(..., description="Whether the API key has expired")
    is_valid: bool = Field(
        ..., description="Whether the API key is valid (active and not expired)"
    )

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


# Permission descriptions for API documentation. Keep keys in sync with
# crud.api_keys.AVAILABLE_PERMISSIONS.
PERMISSION_DESCRIPTIONS = {
    "students:read": PermissionInfo(
        permission="students:read",
        description="Read student information and profiles",
        category="Students",
    ),
    "users:read": PermissionInfo(
        permission="users:read",
        description="List active admins (e.g. to resolve X-On-Behalf-Of by name)",
        category="Users",
    ),
    "assignments:read": PermissionInfo(
        permission="assignments:read",
        description="Read assignment data and submissions",
        category="Assignments",
    ),
    "assignments:write": PermissionInfo(
        permission="assignments:write",
        description="Create and update assignment templates and assignments",
        category="Assignments",
    ),
    "assignments:grade": PermissionInfo(
        permission="assignments:grade",
        description="Grade student assignments and provide feedback",
        category="Assignments",
    ),
    "attendance:read": PermissionInfo(
        permission="attendance:read",
        description="Read attendance records",
        category="Attendance",
    ),
    "attendance:write": PermissionInfo(
        permission="attendance:write",
        description="Create, update, and delete attendance records",
        category="Attendance",
    ),
    "points:read": PermissionInfo(
        permission="points:read",
        description="Read student points and transaction history",
        category="Points",
    ),
    "points:write": PermissionInfo(
        permission="points:write",
        description="Add or deduct student points with notes",
        category="Points",
    ),
    "assignment_types:read": PermissionInfo(
        permission="assignment_types:read",
        description="Read assignment types",
        category="Assignments",
    ),
    "assignment_types:write": PermissionInfo(
        permission="assignment_types:write",
        description="Create, update, and delete assignment types",
        category="Assignments",
    ),
    "terms:read": PermissionInfo(
        permission="terms:read",
        description="Read terms, active term, grade reports, and student term reports",
        category="Terms",
    ),
    "terms:write": PermissionInfo(
        permission="terms:write",
        description="Create, update, activate, and delete terms; auto-link subjects and calculate grades",
        category="Terms",
    ),
    "subjects:read": PermissionInfo(
        permission="subjects:read",
        description="Read the list of subjects",
        category="Subjects",
    ),
    "subjects:write": PermissionInfo(
        permission="subjects:write",
        description="Create, update, and delete subjects",
        category="Subjects",
    ),
    "reports:read": PermissionInfo(
        permission="reports:read",
        description="Read student, admin, attendance, assignment, and report-card reports",
        category="Reports",
    ),
    "journal:read": PermissionInfo(
        permission="journal:read",
        description="Read journal entries and composer data",
        category="Journal",
    ),
    "journal:write": PermissionInfo(
        permission="journal:write",
        description="Create, update, and delete journal entries",
        category="Journal",
    ),
    "journal:moderate": PermissionInfo(
        permission="journal:moderate",
        description="Reply to, react to, mark read, and delete journal entries and replies",
        category="Journal",
    ),
    "activity:read": PermissionInfo(
        permission="activity:read",
        description="Read the recent activity feed",
        category="Activity",
    ),
    "settings:read": PermissionInfo(
        permission="settings:read",
        description="Read application settings, including points presets and journal points",
        category="Settings",
    ),
    "settings:write": PermissionInfo(
        permission="settings:write",
        description="Create and update application settings, including the points system toggle and presets",
        category="Settings",
    ),
    "performance:read": PermissionInfo(
        permission="performance:read",
        description="Read performance statistics and slow-operation reports",
        category="System",
    ),
    "performance:write": PermissionInfo(
        permission="performance:write",
        description="Reset performance statistics",
        category="System",
    ),
    "backup:export": PermissionInfo(
        permission="backup:export",
        description="Export a full system backup",
        category="System",
    ),
    "backup:import": PermissionInfo(
        permission="backup:import",
        description="Import a system backup (overwrites all data — use with extreme caution)",
        category="System",
    ),
    "api_keys:read": PermissionInfo(
        permission="api_keys:read",
        description="Read API key list, details, and usage statistics",
        category="System",
    ),
}
