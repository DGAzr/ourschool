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
CRUD operations for the Points Shop.

Category queries live inline in the router (subjects precedent). Items and
redemptions get CRUD here because of the points accounting.

Accounting note: ``redeem_item`` and ``decline_redemption`` do NOT commit —
they mutate the ledger and balance and leave the transaction open for the
router to commit/rollback atomically (mirrors ``set_assignment_points`` in
``crud/points.py``). ``create_point_transaction`` commits mid-flow and so must
NOT be used inside these; the ``PointTransaction`` is constructed directly.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session, joinedload

from app.crud import points as points_crud
from app.models.points import PointTransaction, StudentPoints
from app.models.shop import ShopItem, ShopRedemption
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --- Items -------------------------------------------------------------------


def get_items(
    db: Session,
    category_id: Optional[int] = None,
    active_only: bool = False,
) -> List[ShopItem]:
    """List shop items, optionally filtered by category / active state."""
    query = db.query(ShopItem).options(joinedload(ShopItem.category))
    if category_id is not None:
        query = query.filter(ShopItem.category_id == category_id)
    if active_only:
        query = query.filter(ShopItem.is_active.is_(True))
    return query.order_by(ShopItem.display_order, ShopItem.id).all()


def get_item(db: Session, item_id: int) -> Optional[ShopItem]:
    """Get a single shop item with its category."""
    return (
        db.query(ShopItem)
        .options(joinedload(ShopItem.category))
        .filter(ShopItem.id == item_id)
        .first()
    )


def create_item(db: Session, data: dict) -> ShopItem:
    """Create a shop item (commits — simple admin write)."""
    item = ShopItem(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return get_item(db, item.id)


def update_item(db: Session, item: ShopItem, data: dict) -> ShopItem:
    """Update a shop item in place (commits)."""
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return get_item(db, item.id)


def delete_item(db: Session, item: ShopItem) -> None:
    """Delete a shop item (commits). Redemptions keep their snapshot via SET NULL."""
    db.delete(item)
    db.commit()


def reorder_items(db: Session, item_ids: List[int]) -> List[ShopItem]:
    """Set ``display_order`` for the given items to their list position (commits).

    Only ids that exist are updated; unknown ids are ignored. Returns the full
    item list in the new order.
    """
    items = {
        item.id: item
        for item in db.query(ShopItem).filter(ShopItem.id.in_(item_ids)).all()
    }
    for position, item_id in enumerate(item_ids):
        item = items.get(item_id)
        if item is not None:
            item.display_order = position
    db.commit()
    return get_items(db)


def set_student_goal(
    db: Session, student_id: int, item_id: Optional[int]
) -> StudentPoints:
    """Set (or clear, with ``item_id=None``) a student's goal item (commits).

    Raises ``LookupError`` if a non-null item is missing or inactive.
    """
    if item_id is not None:
        item = get_item(db, item_id)
        if item is None or not item.is_active:
            raise LookupError("Item not found")
    student_points = points_crud.get_or_create_student_points(db, student_id)
    student_points.goal_item_id = item_id
    db.commit()
    db.refresh(student_points)
    return student_points


# --- Redemption (accounting) -------------------------------------------------


def redeem_item(
    db: Session, student_id: int, item_id: int
) -> Tuple[ShopRedemption, StudentPoints]:
    """Atomically redeem an item for a student. Does NOT commit.

    Lock order is fixed (item, then points) to avoid deadlocks. Raises
    ``LookupError`` if the item is missing/inactive, ``ValueError`` for
    insufficient balance or sold-out. On success returns the new redemption and
    the (updated) StudentPoints; the caller commits.
    """
    # Lock the item row first.
    item = db.query(ShopItem).filter(ShopItem.id == item_id).with_for_update().first()
    if item is None or not item.is_active:
        raise LookupError("Item not found")

    # Ensure a points row exists, then lock it (second in the fixed order).
    points_crud.get_or_create_student_points(db, student_id)
    student_points = (
        db.query(StudentPoints)
        .filter(StudentPoints.student_id == student_id)
        .with_for_update()
        .first()
    )

    # Re-check balance and stock AFTER acquiring the locks.
    if student_points.current_balance < item.cost_points:
        raise ValueError("Insufficient balance")
    if item.quantity_available is not None and item.quantity_available <= 0:
        raise ValueError("Sold out")

    # Spending transaction (constructed directly — no commit).
    txn = PointTransaction(
        student_id=student_id,
        amount=-item.cost_points,
        transaction_type="spending",
        source_description=item.name,
        notes=f"Redeemed shop item: {item.name}",
    )
    db.add(txn)

    student_points.current_balance -= item.cost_points
    student_points.total_spent += item.cost_points

    if item.quantity_available is not None:
        item.quantity_available -= 1
    item.total_redeemed += 1

    db.flush()  # get txn.id

    status = "redeemed" if item.fulfillment_type == "instant" else "pending"
    redemption = ShopRedemption(
        student_id=student_id,
        item_id=item.id,
        item_name=item.name,
        cost_points=item.cost_points,
        fulfillment_type=item.fulfillment_type,
        status=status,
        point_transaction_id=txn.id,
    )
    db.add(redemption)
    db.flush()
    db.refresh(redemption)

    return redemption, student_points


def approve_redemption(
    db: Session, redemption: ShopRedemption, admin_id: Optional[int]
) -> ShopRedemption:
    """pending -> ready. Commits."""
    if redemption.status != "pending":
        raise ValueError(f"Cannot approve a redemption in '{redemption.status}' status")
    redemption.status = "ready"
    redemption.decided_at = _utcnow()
    redemption.decided_by = admin_id
    db.commit()
    db.refresh(redemption)
    return redemption


def fulfill_redemption(db: Session, redemption: ShopRedemption) -> ShopRedemption:
    """ready -> fulfilled. Commits."""
    if redemption.status != "ready":
        raise ValueError(f"Cannot fulfill a redemption in '{redemption.status}' status")
    redemption.status = "fulfilled"
    redemption.fulfilled_at = _utcnow()
    db.commit()
    db.refresh(redemption)
    return redemption


def decline_redemption(
    db: Session,
    redemption: ShopRedemption,
    admin_id: Optional[int],
    actor_name: Optional[str] = None,
) -> ShopRedemption:
    """pending -> declined, refunding the held points. Does NOT commit.

    A dedicated ``'refund'`` transaction restores the balance and decrements
    total_spent (not total_earned). Restocks the item if it still exists and is
    stock-limited.
    """
    if redemption.status != "pending":
        raise ValueError(f"Cannot decline a redemption in '{redemption.status}' status")

    cost = redemption.cost_points

    # Lock order matches redeem_item (item, then points) to avoid deadlocks.
    item = None
    if redemption.item_id is not None:
        item = (
            db.query(ShopItem)
            .filter(ShopItem.id == redemption.item_id)
            .with_for_update()
            .first()
        )

    points_crud.get_or_create_student_points(db, redemption.student_id)
    student_points = (
        db.query(StudentPoints)
        .filter(StudentPoints.student_id == redemption.student_id)
        .with_for_update()
        .first()
    )

    refund_txn = PointTransaction(
        student_id=redemption.student_id,
        amount=cost,
        transaction_type="refund",
        source_description=redemption.item_name,
        notes=f"Refund for declined shop request: {redemption.item_name}",
        admin_id=admin_id,
        actor_name=actor_name,
    )
    db.add(refund_txn)

    student_points.current_balance += cost
    student_points.total_spent = max(0, student_points.total_spent - cost)

    # Restock if the item still exists and is stock-limited.
    if item is not None and item.quantity_available is not None:
        item.quantity_available += 1

    db.flush()  # get refund_txn.id

    redemption.status = "declined"
    redemption.decided_at = _utcnow()
    redemption.decided_by = admin_id
    redemption.refund_transaction_id = refund_txn.id
    db.flush()
    db.refresh(redemption)
    return redemption


# --- Queries -----------------------------------------------------------------


def get_my_redemptions(db: Session, student_id: int) -> List[ShopRedemption]:
    """A student's own redemptions, newest first."""
    return (
        db.query(ShopRedemption)
        .filter(ShopRedemption.student_id == student_id)
        .order_by(desc(ShopRedemption.created_at))
        .all()
    )


def get_admin_redemptions(db: Session, status_group: str) -> List[ShopRedemption]:
    """Admin queue for a status group.

    ``status_group`` is one of ``pending`` | ``ready`` | ``history``.

    - ``pending`` / ``ready`` are request-type only (the approval workflow).
    - ``history`` = fulfilled + declined request-type redemptions **and**
      instant ``redeemed`` ones, so auto-fulfilled purchases show up too.
    """
    query = db.query(ShopRedemption).options(joinedload(ShopRedemption.item))
    if status_group == "pending":
        query = query.filter(
            ShopRedemption.fulfillment_type == "request",
            ShopRedemption.status == "pending",
        )
    elif status_group == "ready":
        query = query.filter(
            ShopRedemption.fulfillment_type == "request",
            ShopRedemption.status == "ready",
        )
    elif status_group == "history":
        query = query.filter(
            ShopRedemption.status.in_(["fulfilled", "declined", "redeemed"])
        )
    else:
        raise ValueError(f"Unknown status group: {status_group}")

    return query.order_by(desc(ShopRedemption.created_at)).all()


def get_redemption(db: Session, redemption_id: int) -> Optional[ShopRedemption]:
    """Get a single redemption by id."""
    return db.query(ShopRedemption).filter(ShopRedemption.id == redemption_id).first()


def get_student_goals(db: Session) -> List[dict]:
    """Per-student goal summaries for the admin "saving toward" block.

    Only students who have chosen a goal (whose item still exists) are returned,
    with the points still needed to reach it. Sorted by student name.
    """
    rows = (
        db.query(StudentPoints)
        .options(
            joinedload(StudentPoints.student),
            joinedload(StudentPoints.goal_item).joinedload(ShopItem.category),
        )
        .filter(StudentPoints.goal_item_id.isnot(None))
        .all()
    )
    goals = []
    for sp in rows:
        if sp.goal_item is None or sp.student is None:
            continue
        cost = sp.goal_item.cost_points
        goals.append(
            {
                "student_id": sp.student_id,
                "student_name": f"{sp.student.first_name} {sp.student.last_name}",
                "item_name": sp.goal_item.name,
                "cost_points": cost,
                "current_balance": sp.current_balance,
                "remaining": max(0, cost - sp.current_balance),
                "category_icon": (
                    sp.goal_item.category.icon if sp.goal_item.category else None
                ),
                "category_color": (
                    sp.goal_item.category.color if sp.goal_item.category else None
                ),
            }
        )
    goals.sort(key=lambda g: g["student_name"].lower())
    return goals


def get_shop_overview(db: Session) -> dict:
    """Counts for the admin stat tiles, plus the per-student goal summaries."""
    pending, ready = db.query(
        func.count(case((ShopRedemption.status == "pending", 1))),
        func.count(case((ShopRedemption.status == "ready", 1))),
    ).one()
    return {
        "pending_redemptions": pending,
        "ready_redemptions": ready,
        "student_goals": get_student_goals(db),
    }


def attach_student_name(db: Session, redemptions: List[ShopRedemption]) -> None:
    """Populate ``student_name`` on redemption rows for admin views."""
    if not redemptions:
        return
    student_ids = {r.student_id for r in redemptions}
    users = db.query(User).filter(User.id.in_(student_ids)).all()
    name_by_id = {u.id: f"{u.first_name} {u.last_name}".strip() for u in users}
    for r in redemptions:
        r.student_name = name_by_id.get(r.student_id)
