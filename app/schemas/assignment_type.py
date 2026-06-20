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

"""Schemas for admin-managed assignment types."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AssignmentTypeBase(BaseModel):
    """Shared assignment-type fields."""

    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#3B82F6", max_length=20)
    weight: float = Field(default=0.0, ge=0, le=100)
    is_active: bool = True
    display_order: int = 0


class AssignmentTypeCreate(AssignmentTypeBase):
    """Schema for creating an assignment type.

    ``key`` is optional; when omitted it is derived from ``name``.
    """

    key: Optional[str] = Field(default=None, max_length=50)


class AssignmentTypeUpdate(BaseModel):
    """Schema for updating an assignment type. ``key`` is immutable."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, max_length=20)
    weight: Optional[float] = Field(default=None, ge=0, le=100)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class AssignmentTypeResponse(AssignmentTypeBase):
    """Schema for returning an assignment type."""

    id: int
    key: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # How many templates currently use this type (drives delete guards in UI).
    usage_count: int = 0

    class Config:
        """Pydantic configuration."""

        from_attributes = True
