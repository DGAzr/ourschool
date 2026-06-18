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
from fastapi import APIRouter

from app.enums import AssignmentStatus, AssignmentType

router = APIRouter()

# Valid permission strings for API keys
API_KEY_PERMISSIONS = [
    "assignments:read",
    "assignments:grade",
    "assignments:create",
    "points:read",
    "points:write",
    "students:read",
    "attendance:read",
    "reports:read",
]


@router.get("/meta")
def get_meta():
    """Return available enum values and permissions. Used by MCP clients to discover valid inputs."""
    return {
        "assignment_types": [t.value for t in AssignmentType],
        "assignment_statuses": [s.value for s in AssignmentStatus],
        "permissions": API_KEY_PERMISSIONS,
    }
