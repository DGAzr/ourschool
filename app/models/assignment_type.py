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

"""Assignment type configuration model.

Assignment types used to be a fixed Python enum. They are now admin-managed
rows so that homeschools can define their own categories and assign each a
grade-book weight. ``assignment_templates.assignment_type`` stores the ``key``
of the matching row.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String

from app.core.database import Base


class AssignmentTypeConfig(Base):
    """Admin-defined assignment type / grade category."""

    __tablename__ = "assignment_types"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    # Stable slug stored on assignment_templates.assignment_type. Immutable
    # once created so existing templates keep resolving.
    key = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(20), nullable=False, default="#3B82F6")
    icon = Column(String(50), nullable=True)
    # Grade-book category weight as a percentage (0-100). When every type that
    # has graded work carries a 0 weight, grading falls back to plain
    # points-weighting (see app.utils.grading.compute_weighted_grade).
    weight = Column(Float, nullable=False, default=0.0)
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
