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

"""API key management endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.crud import api_keys as crud_api_keys
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.api_key import (
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyResponse,
    APIKeyWithSecret,
    APIKeyStats,
    SystemAPIKeyStats,
    AvailablePermissions,
    PERMISSION_DESCRIPTIONS
)

logger = get_logger("api_keys")
router = APIRouter(prefix="/admin/api-keys", tags=["API Keys"])


def require_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency to require admin user for API key management."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage API keys"
        )
    return current_user


@router.get("/permissions", response_model=AvailablePermissions)
async def get_available_permissions(
    current_user: User = Depends(require_admin_user)
):
    """Get all available permissions for API keys."""
    permissions = list(PERMISSION_DESCRIPTIONS.values())
    categories = list(set(p.category for p in permissions))
    
    return AvailablePermissions(
        permissions=permissions,
        categories=sorted(categories)
    )


@router.post("/", response_model=APIKeyWithSecret)
async def create_api_key(
    api_key_data: APIKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Create a new API key."""
    try:
        api_key, full_key = crud_api_keys.create_api_key(
            db=db,
            name=api_key_data.name,
            permissions=api_key_data.permissions,
            creator_id=current_user.id,
            expires_at=api_key_data.expires_at
        )
        
        logger.info(
            f"API key created: {api_key.name} (ID: {api_key.id}) by user {current_user.username}",
            extra={
                "api_key_id": api_key.id,
                "api_key_name": api_key.name,
                "creator_id": current_user.id,
                "creator_username": current_user.username,
                "permissions": api_key.permissions
            }
        )
        
        # Return response with the full API key (only time it's exposed)
        response_data = APIKeyResponse.model_validate(api_key)
        return APIKeyWithSecret(
            **response_data.model_dump(),
            api_key=full_key
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API key"
        )


@router.get("/", response_model=List[APIKeyResponse])
async def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """List all API keys."""
    api_keys = crud_api_keys.get_api_keys(db)
    
    # Convert to response format
    response_keys = []
    for api_key in api_keys:
        response_data = APIKeyResponse.model_validate(api_key)
        response_keys.append(response_data)
    
    return response_keys


@router.get("/stats", response_model=SystemAPIKeyStats)
async def get_system_api_key_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get system-wide API key statistics."""
    return crud_api_keys.get_system_api_key_stats(db)


@router.get("/{api_key_id}", response_model=APIKeyResponse)
async def get_api_key(
    api_key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get a specific API key."""
    api_key = crud_api_keys.get_api_key_by_id(db, api_key_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    return APIKeyResponse.model_validate(api_key)


@router.get("/{api_key_id}/stats", response_model=APIKeyStats)
async def get_api_key_stats(
    api_key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get usage statistics for a specific API key."""
    stats = crud_api_keys.get_api_key_stats(db, api_key_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    return APIKeyStats(**stats)


@router.put("/{api_key_id}", response_model=APIKeyResponse)
async def update_api_key(
    api_key_id: int,
    api_key_data: APIKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Update an API key."""
    try:
        api_key = crud_api_keys.update_api_key(
            db=db,
            api_key_id=api_key_id,
            name=api_key_data.name,
            permissions=api_key_data.permissions,
            is_active=api_key_data.is_active,
            expires_at=api_key_data.expires_at
        )
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        logger.info(
            f"API key updated: {api_key.name} (ID: {api_key.id}) by user {current_user.username}",
            extra={
                "api_key_id": api_key.id,
                "api_key_name": api_key.name,
                "updater_id": current_user.id,
                "updater_username": current_user.username
            }
        )
        
        return APIKeyResponse.model_validate(api_key)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update API key {api_key_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update API key"
        )


@router.post("/{api_key_id}/regenerate", response_model=APIKeyWithSecret)
async def regenerate_api_key(
    api_key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Regenerate an API key's secret."""
    try:
        result = crud_api_keys.regenerate_api_key(db, api_key_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        api_key, full_key = result
        
        logger.warning(
            f"API key regenerated: {api_key.name} (ID: {api_key.id}) by user {current_user.username}",
            extra={
                "api_key_id": api_key.id,
                "api_key_name": api_key.name,
                "regenerator_id": current_user.id,
                "regenerator_username": current_user.username
            }
        )
        
        # Return response with the new full API key
        response_data = APIKeyResponse.model_validate(api_key)
        return APIKeyWithSecret(
            **response_data.model_dump(),
            api_key=full_key
        )
        
    except Exception as e:
        logger.error(f"Failed to regenerate API key {api_key_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate API key"
        )


@router.delete("/{api_key_id}")
async def delete_api_key(
    api_key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Delete an API key."""
    # Get the API key first for logging
    api_key = crud_api_keys.get_api_key_by_id(db, api_key_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    success = crud_api_keys.delete_api_key(db, api_key_id)
    
    if success:
        logger.warning(
            f"API key deleted: {api_key.name} (ID: {api_key.id}) by user {current_user.username}",
            extra={
                "api_key_id": api_key.id,
                "api_key_name": api_key.name,
                "deleter_id": current_user.id,
                "deleter_username": current_user.username
            }
        )
        return {"message": "API key deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API key"
        )