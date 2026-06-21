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

"""APIs for managing assignment types and their grade-book weights."""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import assignment_types as crud_types
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.assignment_type import (
    AssignmentTypeCreate,
    AssignmentTypeResponse,
    AssignmentTypeUpdate,
)

router = APIRouter()


def _require_admin(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")


def _to_response(db: Session, db_type) -> AssignmentTypeResponse:
    resp = AssignmentTypeResponse.from_orm(db_type)
    resp.usage_count = crud_types.usage_count(db, db_type.key)
    return resp


@router.get("/", response_model=List[AssignmentTypeResponse])
def list_assignment_types(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    include_inactive: bool = True,
):
    """List assignment types. Available to any authenticated user."""
    types = crud_types.list_assignment_types(db, include_inactive=include_inactive)
    return [_to_response(db, t) for t in types]


@router.post("/", response_model=AssignmentTypeResponse)
def create_assignment_type(
    payload: AssignmentTypeCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new assignment type (admin only)."""
    _require_admin(current_user)
    db_type = crud_types.create_assignment_type(db, payload)
    return _to_response(db, db_type)


@router.put("/{type_id}", response_model=AssignmentTypeResponse)
def update_assignment_type(
    type_id: int,
    payload: AssignmentTypeUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update an assignment type (admin only)."""
    _require_admin(current_user)
    db_type = crud_types.update_assignment_type(db, type_id, payload)
    if not db_type:
        raise HTTPException(status_code=404, detail="Assignment type not found")
    return _to_response(db, db_type)


@router.delete("/{type_id}")
def delete_assignment_type(
    type_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete an assignment type (admin only). Blocked while still in use."""
    _require_admin(current_user)
    try:
        crud_types.delete_assignment_type(db, type_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Assignment type not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True}
