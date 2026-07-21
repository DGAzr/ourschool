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

"""Points Shop API endpoints.

Every endpoint except the capability-URL image GET is gated behind the points
system enable switch (matching the rest of the points UI).
"""

from typing import Annotated, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    get_actor_name_from_auth,
    get_user_id_from_auth,
    is_admin_user,
    require_admin_or_permission,
    require_student_session,
    require_user_or_permission,
)
from app.core import image_storage
from app.crud import points as points_crud
from app.crud import shop as shop_crud
from app.models.shop import ShopCategory, ShopItem
from app.models.user import User
from app.schemas.points import StudentPoints as StudentPointsSchema
from app.schemas.shop import (
    RedeemRequest,
    RedeemResponse,
    ReorderRequest,
    SetGoalRequest,
    ShopAdminOverview,
    ShopCategory as ShopCategorySchema,
    ShopCategoryCreate,
    ShopCategoryUpdate,
    ShopImageUploadResponse,
    ShopItem as ShopItemSchema,
    ShopItemCreate,
    ShopItemPatch,
    ShopItemUpdate,
    ShopRedemption as ShopRedemptionSchema,
)

router = APIRouter(prefix="/shop", tags=["shop"])


def _require_shop_enabled(db: Session) -> None:
    """403 if the points system (which gates the shop) is disabled."""
    if not points_crud.is_points_system_enabled(db):
        raise HTTPException(status_code=403, detail="Points system is disabled")


def _get_category_or_404(db: Session, category_id: int) -> ShopCategory:
    category = db.query(ShopCategory).filter(ShopCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _get_item_or_404(db: Session, item_id: int) -> ShopItem:
    item = shop_crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# --- Categories --------------------------------------------------------------


@router.get("/categories", response_model=List[ShopCategorySchema])
def list_categories(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("shop:read"))],
):
    """List categories with a count of active items in each."""
    _require_shop_enabled(db)
    categories = (
        db.query(ShopCategory)
        .order_by(ShopCategory.sort_order, ShopCategory.name)
        .all()
    )
    # Attach active item counts.
    counts = dict(
        db.query(ShopItem.category_id, func.count(ShopItem.id))
        .filter(ShopItem.is_active.is_(True))
        .group_by(ShopItem.category_id)
        .all()
    )
    for cat in categories:
        cat.item_count = counts.get(cat.id, 0)
    return categories


@router.post("/categories", response_model=ShopCategorySchema)
def create_category(
    payload: ShopCategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Create a category."""
    _require_shop_enabled(db)
    category = ShopCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=ShopCategorySchema)
def update_category(
    category_id: int,
    payload: ShopCategoryUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Update a category."""
    _require_shop_enabled(db)
    category = _get_category_or_404(db, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Delete a category. Blocked (400) if any item references it."""
    _require_shop_enabled(db)
    category = _get_category_or_404(db, category_id)
    item_count = db.query(ShopItem).filter(ShopItem.category_id == category_id).count()
    if item_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category: {item_count} item(s) are using it.",
        )
    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}


# --- Items -------------------------------------------------------------------


@router.get("/items", response_model=List[ShopItemSchema])
def list_items(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("shop:read"))],
    category_id: Optional[int] = Query(None),
):
    """List items. Session students see active items only; API keys see all."""
    _require_shop_enabled(db)
    # A student session is restricted to active items; admins and API keys see all.
    active_only = isinstance(auth_user, User) and not is_admin_user(auth_user)
    return shop_crud.get_items(db, category_id=category_id, active_only=active_only)


@router.get("/items/{item_id}", response_model=ShopItemSchema)
def get_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_user_or_permission("shop:read"))],
):
    """Get a single item. Students get 404 for hidden items."""
    _require_shop_enabled(db)
    item = _get_item_or_404(db, item_id)
    is_student = isinstance(auth_user, User) and not is_admin_user(auth_user)
    if is_student and not item.is_active:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/items", response_model=ShopItemSchema)
def create_item(
    payload: ShopItemCreate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Create an item."""
    _require_shop_enabled(db)
    _get_category_or_404(db, payload.category_id)
    return shop_crud.create_item(db, payload.model_dump())


@router.put("/items/reorder", response_model=List[ShopItemSchema])
def reorder_items(
    payload: ReorderRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Set the storefront display order from a full ordered list of item ids."""
    _require_shop_enabled(db)
    return shop_crud.reorder_items(db, payload.item_ids)


@router.put("/items/{item_id}", response_model=ShopItemSchema)
def update_item(
    item_id: int,
    payload: ShopItemUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Update an item. Removed image ids are best-effort deleted from storage."""
    _require_shop_enabled(db)
    item = _get_item_or_404(db, item_id)
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        _get_category_or_404(db, data["category_id"])

    # Best-effort cleanup of images dropped from the item.
    if "image_ids" in data:
        removed = set(item.image_ids or []) - set(data["image_ids"] or [])
        for external_id in removed:
            image_storage.delete_image(db, external_id)

    return shop_crud.update_item(db, item, data)


@router.patch("/items/{item_id}", response_model=ShopItemSchema)
def patch_item_active(
    item_id: int,
    payload: ShopItemPatch,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Toggle Live/Hidden (is_active)."""
    _require_shop_enabled(db)
    item = _get_item_or_404(db, item_id)
    return shop_crud.update_item(db, item, {"is_active": payload.is_active})


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Delete an item (its images are best-effort removed)."""
    _require_shop_enabled(db)
    item = _get_item_or_404(db, item_id)
    for external_id in item.image_ids or []:
        image_storage.delete_image(db, external_id)
    shop_crud.delete_item(db, item)
    return {"message": "Item deleted successfully"}


# --- Redemptions -------------------------------------------------------------


@router.post("/redeem", response_model=RedeemResponse)
def redeem(
    payload: RedeemRequest,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student_session("/shop/redeem"))],
):
    """Redeem an item (student). Commits atomically; refunds on failure."""
    _require_shop_enabled(db)
    try:
        redemption, student_points = shop_crud.redeem_item(
            db, student.id, payload.item_id
        )
        db.commit()
    except LookupError:
        db.rollback()
        raise HTTPException(status_code=404, detail="Item not found")
    except ValueError as exc:
        db.rollback()
        message = str(exc)
        status_code = 409 if message == "Sold out" else 400
        raise HTTPException(status_code=status_code, detail=message)

    db.refresh(redemption)
    db.refresh(student_points)
    student_points.student_name = f"{student.first_name} {student.last_name}"
    points_crud.attach_goal_item(student_points)
    return RedeemResponse(redemption=redemption, student_points=student_points)


@router.get("/my-redemptions", response_model=List[ShopRedemptionSchema])
def my_redemptions(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student_session("/shop/redemptions"))],
):
    """The current student's redemptions."""
    _require_shop_enabled(db)
    return shop_crud.get_my_redemptions(db, student.id)


@router.put("/my-goal", response_model=StudentPointsSchema)
def set_my_goal(
    payload: SetGoalRequest,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student_session("/shop/my-goal"))],
):
    """Set (or clear) the item the current student is saving toward."""
    _require_shop_enabled(db)
    try:
        student_points = shop_crud.set_student_goal(db, student.id, payload.item_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Item not found")
    student_points.student_name = f"{student.first_name} {student.last_name}"
    points_crud.attach_goal_item(student_points)
    return student_points


@router.get("/redemptions", response_model=List[ShopRedemptionSchema])
def admin_redemptions(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:read"))],
    status: str = Query("pending", pattern="^(pending|ready|history)$"),
):
    """Admin redemption queue (request-type only)."""
    _require_shop_enabled(db)
    redemptions = shop_crud.get_admin_redemptions(db, status)
    shop_crud.attach_student_name(db, redemptions)
    return redemptions


@router.post(
    "/redemptions/{redemption_id}/approve", response_model=ShopRedemptionSchema
)
def approve_redemption(
    redemption_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Approve a pending request (-> ready)."""
    _require_shop_enabled(db)
    redemption = shop_crud.get_redemption(db, redemption_id)
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    admin_id = get_user_id_from_auth(auth_user)
    try:
        return shop_crud.approve_redemption(db, redemption, admin_id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))


@router.post(
    "/redemptions/{redemption_id}/decline", response_model=ShopRedemptionSchema
)
def decline_redemption(
    redemption_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Decline a pending request (-> declined) and refund the held points."""
    _require_shop_enabled(db)
    redemption = shop_crud.get_redemption(db, redemption_id)
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    admin_id = get_user_id_from_auth(auth_user)
    actor_name = get_actor_name_from_auth(auth_user)
    try:
        result = shop_crud.decline_redemption(db, redemption, admin_id, actor_name)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))
    db.refresh(result)
    return result


@router.post(
    "/redemptions/{redemption_id}/fulfill", response_model=ShopRedemptionSchema
)
def fulfill_redemption(
    redemption_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Mark a ready request as fulfilled (-> fulfilled)."""
    _require_shop_enabled(db)
    redemption = shop_crud.get_redemption(db, redemption_id)
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    try:
        return shop_crud.fulfill_redemption(db, redemption)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/admin/overview", response_model=ShopAdminOverview)
def admin_overview(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:read"))],
):
    """Counts for the admin stat tiles."""
    _require_shop_enabled(db)
    return shop_crud.get_shop_overview(db)


# --- Images ------------------------------------------------------------------


@router.post("/images", response_model=ShopImageUploadResponse)
async def upload_image(
    request: Request,
    file: UploadFile,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[AuthUser, Depends(require_admin_or_permission("shop:write"))],
):
    """Upload an image; returns its id and capability URL."""
    _require_shop_enabled(db)
    raw = await file.read()
    try:
        data, mime = image_storage.process_upload(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    external_id = image_storage.store_image(db, data, mime)
    db.commit()
    url = str(request.url_for("get_shop_image", image_id=external_id))
    return ShopImageUploadResponse(id=external_id, url=url)


@router.get("/images/{image_id}", name="get_shop_image")
def get_shop_image(
    image_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    """Serve an image by capability URL (unguessable UUID; no auth).

    Immutable cache + ETag/304. Not gated behind the shop-enabled switch so
    plain ``<img src>`` keeps working.
    """
    # 304 short-circuit: the external_id is the ETag (content is immutable).
    etag = f'"{image_id}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    result = image_storage.get_image(db, image_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Image not found")
    data, mime = result
    return Response(
        content=data,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": etag,
        },
    )
