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

"""User schemas."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.enums import UserRole


class UserBase(BaseModel):
    """Base schema for users."""

    email: EmailStr
    username: str
    first_name: str
    last_name: str
    role: UserRole
    # Student-specific fields (only required for student users)
    parent_id: Optional[int] = None
    date_of_birth: Optional[date] = None
    grade_level: Optional[int] = None


class UserCreate(UserBase):
    """Schema for creating users."""

    password: str


class UserUpdate(BaseModel):
    """Schema for updating users."""

    email: Optional[EmailStr] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    # Student-specific fields
    parent_id: Optional[int] = None
    date_of_birth: Optional[date] = None
    grade_level: Optional[int] = None


class User(UserBase):
    """Schema for users."""

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class Token(BaseModel):
    """Schema for tokens."""

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Schema for token data."""

    username: Optional[str] = None