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

"""Points Shop Pydantic schemas for API requests and responses."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.points import StudentPoints

ALLOWED_FULFILLMENT_TYPES = {"instant", "request"}
REDEMPTION_STATUSES = {"redeemed", "pending", "ready", "fulfilled", "declined"}


# --- Categories --------------------------------------------------------------


class ShopCategoryBase(BaseModel):
    """Base schema for shop categories."""

    name: str
    color: str = "#9A8A4F"
    icon: Optional[str] = None
    sort_order: int = 0


class ShopCategoryCreate(ShopCategoryBase):
    """Schema for creating a shop category."""


class ShopCategoryUpdate(BaseModel):
    """Schema for updating a shop category."""

    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None


class ShopCategory(ShopCategoryBase):
    """Schema for shop category responses."""

    id: int
    external_id: str
    created_at: datetime

    # Number of active items in this category (attached by the router).
    item_count: Optional[int] = None

    class Config:
        from_attributes = True


# --- Items -------------------------------------------------------------------


class ShopItemBase(BaseModel):
    """Base schema for shop items."""

    name: str
    category_id: int
    description: Optional[str] = None
    cost_points: int
    quantity_available: Optional[int] = None
    fulfillment_type: str = "instant"
    is_active: bool = True
    image_ids: List[str] = Field(default_factory=list)

    @field_validator("cost_points")
    @classmethod
    def _validate_cost(cls, v: int) -> int:
        if v < 0:
            raise ValueError("cost_points must be >= 0")
        return v

    @field_validator("quantity_available")
    @classmethod
    def _validate_quantity(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("quantity_available must be None or >= 0")
        return v

    @field_validator("fulfillment_type")
    @classmethod
    def _validate_fulfillment(cls, v: str) -> str:
        if v not in ALLOWED_FULFILLMENT_TYPES:
            raise ValueError(
                f"fulfillment_type must be one of {sorted(ALLOWED_FULFILLMENT_TYPES)}"
            )
        return v


class ShopItemCreate(ShopItemBase):
    """Schema for creating a shop item."""


class ShopItemUpdate(BaseModel):
    """Schema for updating a shop item (all fields optional)."""

    name: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    cost_points: Optional[int] = None
    quantity_available: Optional[int] = None
    fulfillment_type: Optional[str] = None
    is_active: Optional[bool] = None
    image_ids: Optional[List[str]] = None

    @field_validator("cost_points")
    @classmethod
    def _validate_cost(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("cost_points must be >= 0")
        return v

    @field_validator("quantity_available")
    @classmethod
    def _validate_quantity(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("quantity_available must be None or >= 0")
        return v

    @field_validator("fulfillment_type")
    @classmethod
    def _validate_fulfillment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_FULFILLMENT_TYPES:
            raise ValueError(
                f"fulfillment_type must be one of {sorted(ALLOWED_FULFILLMENT_TYPES)}"
            )
        return v


class ShopItemPatch(BaseModel):
    """Schema for the Live/Hidden toggle (PATCH)."""

    is_active: bool


class ShopItem(ShopItemBase):
    """Schema for shop item responses."""

    id: int
    external_id: str
    total_redeemed: int
    display_order: int
    created_at: datetime
    updated_at: datetime

    category: Optional[ShopCategory] = None

    class Config:
        from_attributes = True


# --- Redemptions -------------------------------------------------------------


class ShopRedemption(BaseModel):
    """Schema for redemption responses."""

    id: int
    external_id: str
    student_id: int
    item_id: Optional[int] = None
    item_name: str
    cost_points: int
    fulfillment_type: str
    status: str
    created_at: datetime
    decided_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None

    # Attached by the router / CRUD.
    student_name: Optional[str] = None
    item: Optional[ShopItem] = None

    class Config:
        from_attributes = True


class RedeemRequest(BaseModel):
    """Body for POST /shop/redeem."""

    item_id: int


class RedeemResponse(BaseModel):
    """Response for POST /shop/redeem."""

    redemption: ShopRedemption
    student_points: StudentPoints


class StudentGoalSummary(BaseModel):
    """One student's chosen goal, for the admin "saving toward" block."""

    student_id: int
    student_name: str
    item_name: str
    cost_points: int
    current_balance: int
    remaining: int
    category_icon: Optional[str] = None
    category_color: Optional[str] = None


class ShopAdminOverview(BaseModel):
    """Counts for the admin stat tiles."""

    pending_redemptions: int
    ready_redemptions: int
    student_goals: List[StudentGoalSummary] = Field(default_factory=list)


class ShopImageUploadResponse(BaseModel):
    """Response for POST /shop/images."""

    id: str
    url: str


class SetGoalRequest(BaseModel):
    """Body for PUT /shop/my-goal. ``item_id=None`` clears the goal."""

    item_id: Optional[int] = None


class ReorderRequest(BaseModel):
    """Body for PUT /shop/items/reorder — the full ordered list of item ids."""

    item_ids: List[int]
