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

"""Meta endpoint — exposes enum values and permissions for MCP discovery."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import assignment_types as crud_types
from app.crud.api_keys import AVAILABLE_PERMISSIONS
from app.enums import AssignmentStatus

router = APIRouter()


@router.get("/meta")
def get_meta(db: Annotated[Session, Depends(get_db)]):
    """Return available enum values and permissions. Used by MCP clients to discover valid inputs.

    Assignment types are admin-managed, so the valid keys are sourced from the
    ``assignment_types`` table. Permissions are sourced from the single
    canonical list in ``crud.api_keys.AVAILABLE_PERMISSIONS`` so discovery never
    advertises a permission that can't be created or has no backing endpoint.
    """
    active_types = crud_types.list_assignment_types(db, include_inactive=False)
    return {
        "assignment_types": [t.key for t in active_types],
        "assignment_statuses": [s.value for s in AssignmentStatus],
        "permissions": list(AVAILABLE_PERMISSIONS),
        # API-key writes may attribute to a real admin via this header
        # (value: user ID or username; must be an active admin).
        "on_behalf_of_header": "X-On-Behalf-Of",
    }
