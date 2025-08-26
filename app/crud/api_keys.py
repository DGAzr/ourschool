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

"""CRUD operations for API keys."""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.security import generate_api_key, hash_api_key
from app.models.api_key import APIKey
from app.models.user import User


def create_api_key(
    db: Session,
    name: str,
    permissions: List[str],
    creator_id: int,
    expires_at: Optional[datetime] = None
) -> tuple[APIKey, str]:
    """Create a new API key and return the model and the plain text key."""
    # Generate API key
    full_key, prefix = generate_api_key()
    key_hash = hash_api_key(full_key)
    
    # Create database record
    api_key = APIKey(
        name=name,
        key_hash=key_hash,
        key_prefix=prefix,
        permissions=permissions,
        created_by=creator_id,
        expires_at=expires_at
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    return api_key, full_key


def get_api_keys(db: Session, created_by: Optional[int] = None) -> List[APIKey]:
    """Get all API keys, optionally filtered by creator."""
    query = db.query(APIKey)
    
    if created_by is not None:
        query = query.filter(APIKey.created_by == created_by)
    
    return query.order_by(desc(APIKey.created_at)).all()


def get_api_key_by_id(db: Session, api_key_id: int) -> Optional[APIKey]:
    """Get an API key by its ID."""
    return db.query(APIKey).filter(APIKey.id == api_key_id).first()


def get_api_key_by_prefix(db: Session, prefix: str) -> Optional[APIKey]:
    """Get an API key by its prefix."""
    return db.query(APIKey).filter(
        APIKey.key_prefix == prefix,
        APIKey.is_active == True
    ).first()


def update_api_key(
    db: Session,
    api_key_id: int,
    name: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    is_active: Optional[bool] = None,
    expires_at: Optional[datetime] = None
) -> Optional[APIKey]:
    """Update an API key."""
    api_key = get_api_key_by_id(db, api_key_id)
    if not api_key:
        return None
    
    if name is not None:
        api_key.name = name
    if permissions is not None:
        api_key.permissions = permissions
    if is_active is not None:
        api_key.is_active = is_active
    if expires_at is not None:
        api_key.expires_at = expires_at
    
    api_key.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(api_key)
    
    return api_key


def delete_api_key(db: Session, api_key_id: int) -> bool:
    """Delete an API key."""
    api_key = get_api_key_by_id(db, api_key_id)
    if not api_key:
        return False
    
    db.delete(api_key)
    db.commit()
    return True


def regenerate_api_key(db: Session, api_key_id: int) -> Optional[tuple[APIKey, str]]:
    """Regenerate an API key's secret and return the model and new plain text key."""
    api_key = get_api_key_by_id(db, api_key_id)
    if not api_key:
        return None
    
    # Generate new key
    full_key, prefix = generate_api_key()
    key_hash = hash_api_key(full_key)
    
    # Update the record
    api_key.key_hash = key_hash
    api_key.key_prefix = prefix
    api_key.updated_at = datetime.utcnow()
    api_key.last_used_at = None  # Reset usage tracking
    
    db.commit()
    db.refresh(api_key)
    
    return api_key, full_key


def record_api_key_usage(db: Session, api_key_id: int) -> None:
    """Record that an API key was used."""
    api_key = get_api_key_by_id(db, api_key_id)
    if api_key:
        api_key.last_used_at = datetime.utcnow()
        db.commit()


def get_api_key_stats(db: Session, api_key_id: int) -> Optional[Dict[str, Any]]:
    """Get usage statistics for an API key."""
    api_key = get_api_key_by_id(db, api_key_id)
    if not api_key:
        return None
    
    # Basic stats - can be expanded with actual usage logging later
    stats = {
        "id": api_key.id,
        "name": api_key.name,
        "created_at": api_key.created_at,
        "last_used_at": api_key.last_used_at,
        "is_active": api_key.is_active,
        "is_expired": api_key.is_expired,
        "permissions_count": len(api_key.permissions),
        "permissions": api_key.permissions
    }
    
    return stats


def get_system_api_key_stats(db: Session) -> Dict[str, Any]:
    """Get system-wide API key statistics."""
    total_keys = db.query(func.count(APIKey.id)).scalar()
    active_keys = db.query(func.count(APIKey.id)).filter(APIKey.is_active == True).scalar()
    expired_keys = db.query(func.count(APIKey.id)).filter(
        APIKey.expires_at.isnot(None),
        APIKey.expires_at < datetime.utcnow()
    ).scalar()
    
    # Keys used in the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recently_used = db.query(func.count(APIKey.id)).filter(
        APIKey.last_used_at.isnot(None),
        APIKey.last_used_at > thirty_days_ago
    ).scalar()
    
    return {
        "total_keys": total_keys,
        "active_keys": active_keys,
        "expired_keys": expired_keys,
        "recently_used_keys": recently_used,
        "inactive_keys": total_keys - active_keys
    }


# Permission constants
AVAILABLE_PERMISSIONS = [
    "students:read",
    "students:write", 
    "attendance:read",
    "attendance:write",
    "assignments:read",
    "assignments:write",
    "assignments:grade",
    "points:read",
    "points:write",
    "reports:read",
    "admin:read",
    "admin:write"
]


def validate_permissions(permissions: List[str]) -> List[str]:
    """Validate that all permissions are valid."""
    invalid_permissions = [p for p in permissions if p not in AVAILABLE_PERMISSIONS]
    if invalid_permissions:
        raise ValueError(f"Invalid permissions: {invalid_permissions}")
    return permissions