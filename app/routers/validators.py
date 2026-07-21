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

"""Request-validation helpers shared across routers."""

from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User, UserRole


def validate_students(db: Session, student_ids: List[int]) -> List[User]:
    """Resolve student ids to active STUDENT users; 404 if any are missing.

    Shared by lesson planning and assignment composition so neither surface
    can reference inactive/non-student/absent users.
    """
    if not student_ids:
        return []
    students = (
        db.query(User)
        .filter(
            User.id.in_(student_ids),
            User.role == UserRole.STUDENT,
            User.is_active,
        )
        .all()
    )
    missing = set(student_ids) - {s.id for s in students}
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Students with IDs {sorted(missing)} not found or access denied",
        )
    return students
