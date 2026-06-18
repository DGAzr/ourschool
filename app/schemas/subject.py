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

"""Subject schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SubjectBase(BaseModel):
    """Base schema for subjects."""

    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"


class SubjectCreate(SubjectBase):
    """Schema for creating subjects."""


class SubjectUpdate(BaseModel):
    """Schema for updating subjects."""

    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class Subject(SubjectBase):
    """Schema for subjects."""

    id: int
    created_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True
