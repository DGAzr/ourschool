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

"""CRUD operations for admin-managed assignment types."""
import re
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assignment import AssignmentTemplate
from app.models.assignment_type import AssignmentTypeConfig
from app.schemas.assignment_type import AssignmentTypeCreate, AssignmentTypeUpdate


# Default categories seeded on a fresh database (key, name, color). Weights
# start at 0 so grading behaves as plain points-weighting until configured.
DEFAULT_ASSIGNMENT_TYPES = [
    ("homework", "Homework", "#3B82F6"),
    ("project", "Project", "#8B5CF6"),
    ("test", "Test", "#EF4444"),
    ("quiz", "Quiz", "#F59E0B"),
    ("essay", "Essay", "#10B981"),
    ("presentation", "Presentation", "#EC4899"),
    ("worksheet", "Worksheet", "#6366F1"),
    ("reading", "Reading", "#14B8A6"),
    ("practice", "Practice", "#84CC16"),
]


def ensure_default_assignment_types(db: Session) -> None:
    """Seed the built-in assignment types if the table is empty.

    Production seeds these via Alembic; this is a safety net for environments
    that build the schema straight from the ORM metadata (e.g. tests).
    """
    if db.query(AssignmentTypeConfig.id).first() is not None:
        return
    for idx, (key, name, color) in enumerate(DEFAULT_ASSIGNMENT_TYPES):
        db.add(
            AssignmentTypeConfig(
                key=key, name=name, color=color, weight=0.0,
                is_active=True, display_order=idx,
            )
        )
    db.commit()


def slugify_key(value: str) -> str:
    """Turn a display name into a stable lowercase slug key."""
    slug = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return slug or "type"


def list_assignment_types(
    db: Session, include_inactive: bool = True
) -> List[AssignmentTypeConfig]:
    """Return assignment types ordered for display."""
    query = db.query(AssignmentTypeConfig)
    if not include_inactive:
        query = query.filter(AssignmentTypeConfig.is_active.is_(True))
    return query.order_by(
        AssignmentTypeConfig.display_order, AssignmentTypeConfig.name
    ).all()


def get_assignment_type(db: Session, type_id: int) -> Optional[AssignmentTypeConfig]:
    """Get a single assignment type by id."""
    return (
        db.query(AssignmentTypeConfig)
        .filter(AssignmentTypeConfig.id == type_id)
        .first()
    )


def get_by_key(db: Session, key: str) -> Optional[AssignmentTypeConfig]:
    """Get a single assignment type by its stable key."""
    return (
        db.query(AssignmentTypeConfig)
        .filter(AssignmentTypeConfig.key == key)
        .first()
    )


def usage_count(db: Session, key: str) -> int:
    """Number of assignment templates referencing this type key."""
    return (
        db.query(func.count(AssignmentTemplate.id))
        .filter(AssignmentTemplate.assignment_type == key)
        .scalar()
        or 0
    )


def _unique_key(db: Session, base: str) -> str:
    """Return a key based on ``base`` that does not collide with an existing one."""
    key = base
    suffix = 2
    while get_by_key(db, key) is not None:
        key = f"{base}_{suffix}"
        suffix += 1
    return key


def create_assignment_type(
    db: Session, payload: AssignmentTypeCreate
) -> AssignmentTypeConfig:
    """Create a new assignment type, deriving a unique key when needed."""
    base_key = slugify_key(payload.key) if payload.key else slugify_key(payload.name)
    key = _unique_key(db, base_key)

    db_type = AssignmentTypeConfig(
        key=key,
        name=payload.name,
        color=payload.color,
        weight=payload.weight,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    db.add(db_type)
    db.commit()
    db.refresh(db_type)
    return db_type


def update_assignment_type(
    db: Session, type_id: int, payload: AssignmentTypeUpdate
) -> Optional[AssignmentTypeConfig]:
    """Update mutable fields of an assignment type (key is immutable)."""
    db_type = get_assignment_type(db, type_id)
    if not db_type:
        return None

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(db_type, field, value)

    db.commit()
    db.refresh(db_type)
    return db_type


def delete_assignment_type(db: Session, type_id: int) -> AssignmentTypeConfig:
    """Delete an assignment type.

    Raises ``ValueError`` when templates still reference it so callers can
    surface a friendly error (archive via ``is_active`` instead).
    """
    db_type = get_assignment_type(db, type_id)
    if not db_type:
        raise LookupError("Assignment type not found")

    in_use = usage_count(db, db_type.key)
    if in_use:
        raise ValueError(
            f"{in_use} assignment template(s) still use this type. "
            "Reassign them or deactivate this type instead of deleting it."
        )

    db.delete(db_type)
    db.commit()
    return db_type
