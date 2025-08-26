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

"""API key models for external integrations."""
from datetime import datetime
from typing import List

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    JSON,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class APIKey(Base):
    """API key model for external system authentication."""

    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True)
    key_prefix = Column(String(8), nullable=False, index=True)
    permissions = Column(JSON, nullable=False)  # List of permission strings
    is_active = Column(Boolean, default=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    def has_permission(self, permission: str) -> bool:
        """Check if this API key has a specific permission."""
        if not self.is_active:
            return False
        
        if self.expires_at and self.expires_at < datetime.utcnow():
            return False
            
        return permission in self.permissions

    def has_any_permission(self, permissions: List[str]) -> bool:
        """Check if this API key has any of the specified permissions."""
        return any(self.has_permission(perm) for perm in permissions)

    def has_all_permissions(self, permissions: List[str]) -> bool:
        """Check if this API key has all of the specified permissions."""
        return all(self.has_permission(perm) for perm in permissions)

    @property
    def is_expired(self) -> bool:
        """Check if this API key is expired."""
        return self.expires_at is not None and self.expires_at < datetime.utcnow()

    @property
    def is_valid(self) -> bool:
        """Check if this API key is valid (active and not expired)."""
        return self.is_active and not self.is_expired