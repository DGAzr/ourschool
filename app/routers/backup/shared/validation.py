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

"""Validation utilities for backup operations."""
import logging
from datetime import datetime
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def validate_backup_data(backup_data: Dict[str, Any]) -> List[str]:
    """Validate backup data structure and return any errors.
    
    Args:
        backup_data: The backup data to validate
        
    Returns:
        List of validation error messages
    """
    errors = []
    
    # Check required fields
    required_fields = [
        'export_timestamp', 'format_version', 'users', 'subjects', 
        'terms', 'lessons', 'assignment_templates'
    ]
    
    for field in required_fields:
        if field not in backup_data:
            errors.append(f"Missing required field: {field}")
    
    # Validate format version
    if 'format_version' in backup_data:
        version = backup_data['format_version']
        if version != "1.0":
            errors.append(f"Unsupported backup format version: {version}")
    
    # Validate timestamp
    if 'export_timestamp' in backup_data:
        try:
            datetime.fromisoformat(backup_data['export_timestamp'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            errors.append("Invalid export_timestamp format")
    
    return errors


def log_backup_operation(operation: str, user_email: str, details: str = ""):
    """Log backup operation for audit trail.
    
    Args:
        operation: The operation being performed (export/import)
        user_email: Email of user performing operation
        details: Additional details about the operation
    """
    logger.info(f"Backup {operation} by user {user_email}. {details}")


def sanitize_import_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize import data by removing sensitive fields.
    
    Args:
        data: The import data to sanitize
        
    Returns:
        Sanitized data dictionary
    """
    # Remove any password fields for security
    if 'users' in data:
        for user in data['users']:
            if 'password_hash' in user:
                del user['password_hash']
            if 'password' in user:
                del user['password']
    
    return data