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

"""Backup router module - refactored from monolithic backup.py.

This module organizes backup-related endpoints into logical sub-modules:
- database.py: Database backup and restore operations
- exporters.py: Individual entity export logic
- importers.py: Individual entity import logic  
- shared/: Common utilities (permissions, validation)

The backup router handles complete system backup and restore operations
for data protection and migration between instances.
"""
from fastapi import APIRouter

from .database import router as database_router

# Create the main backup router
router = APIRouter()

# Include database operations router
router.include_router(database_router, tags=["backup"])

__all__ = ["router"]