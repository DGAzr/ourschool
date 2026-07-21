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

"""
Points Shop models.

Students spend their accumulated points (see ``models/points.py``) on a catalog
of admin-curated reward items. Admins manage categories/items and work an
approval queue for ``request``-type redemptions. Everything is gated behind the
existing points-system enable switch.

Style follows ``models/subject.py`` (external_id uuid4, tz-aware UTC timestamps)
and ``models/points.py``.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ShopCategory(Base):
    """Admin-defined storefront category (mirrors ``Subject``)."""

    __tablename__ = "shop_categories"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    name = Column(String(255), nullable=False)
    color = Column(String, default="#9A8A4F")
    icon = Column(String, nullable=True)  # emoji / glyph used as the fallback visual
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    items = relationship("ShopItem", back_populates="category")


class ShopImage(Base):
    """Pure blob store for shop item photos.

    No item FK — uploads happen before an item exists, and items reference
    images by ``external_id`` in their ``image_ids`` list. This keeps the
    storage seam thin (see ``core/image_storage.py``): an S3 backend could
    replace the bytea column without touching the item/redemption schema.
    """

    __tablename__ = "shop_images"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class ShopItem(Base):
    """A purchasable catalog item."""

    __tablename__ = "shop_items"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    name = Column(String(255), nullable=False)
    category_id = Column(
        Integer,
        ForeignKey("shop_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    description = Column(Text, nullable=True)
    cost_points = Column(Integer, nullable=False)
    # NULL = unlimited stock.
    quantity_available = Column(Integer, nullable=True)
    fulfillment_type = Column(String(20), nullable=False, default="instant")
    is_active = Column(Boolean, nullable=False, default=True)
    # Admin-defined storefront order (ascending); ties break on id.
    display_order = Column(Integer, nullable=False, default=0)
    # Ordered list of ShopImage.external_id strings; first is the cover.
    image_ids = Column(JSON, nullable=False, default=list)
    total_redeemed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    category = relationship("ShopCategory", back_populates="items")


class ShopRedemption(Base):
    """A student "order" against a shop item.

    Snapshots item name/cost/fulfillment_type at redemption time so history
    stays accurate even if the item is later renamed, repriced, or deleted.
    """

    __tablename__ = "shop_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    student_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id = Column(
        Integer,
        ForeignKey("shop_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Snapshots (survive item mutation/deletion).
    item_name = Column(String(255), nullable=False)
    cost_points = Column(Integer, nullable=False)
    fulfillment_type = Column(String(20), nullable=False)
    # redeemed | pending | ready | fulfilled | declined
    status = Column(String(20), nullable=False, index=True)
    point_transaction_id = Column(
        Integer,
        ForeignKey("point_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    refund_transaction_id = Column(
        Integer,
        ForeignKey("point_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
    decided_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    item = relationship("ShopItem")
    student = relationship("User", foreign_keys=[student_id])
