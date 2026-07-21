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

"""CRUD-level tests for the Points Shop: redemption accounting + image seam."""

import io
import itertools

import pytest
from PIL import Image

from app.crud import shop as shop_crud
from app.core import image_storage
from app.models.points import PointTransaction, StudentPoints
from app.models.shop import ShopCategory, ShopItem


def _make_category(db, name="Treats"):
    cat = ShopCategory(name=name, color="#C0892F", icon="🍩")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def _make_item(db, category, **kwargs):
    defaults = dict(
        name="Cookie",
        category_id=category.id,
        description="A tasty cookie",
        cost_points=50,
        quantity_available=None,
        fulfillment_type="instant",
        is_active=True,
        image_ids=[],
    )
    defaults.update(kwargs)
    item = ShopItem(**defaults)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _make_student(db, seq):
    from app.models.user import User
    from app.enums import UserRole

    user = User(
        email=f"crudstudent{seq}@test.local",
        username=f"crudstudent{seq}",
        first_name="Cru",
        last_name=f"Dent{seq}",
        role=UserRole.STUDENT,
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _give_points(db, student_id, amount):
    sp = StudentPoints(
        student_id=student_id,
        current_balance=amount,
        total_earned=amount,
        total_spent=0,
    )
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return sp


# Tables persist for the whole test session, so student usernames must be unique
# across every test in this module.
_student_seq = itertools.count(1000)


@pytest.fixture()
def student_seq():
    return _student_seq


def test_instant_redeem_happy_path(db_session, student_seq):
    cat = _make_category(db_session)
    item = _make_item(db_session, cat, cost_points=50, quantity_available=5)
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    redemption, sp = shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.commit()

    assert redemption.status == "redeemed"
    assert redemption.item_name == "Cookie"
    assert redemption.cost_points == 50
    assert sp.current_balance == 50
    assert sp.total_spent == 50

    db_session.refresh(item)
    assert item.quantity_available == 4
    assert item.total_redeemed == 1

    txn = (
        db_session.query(PointTransaction)
        .filter(PointTransaction.id == redemption.point_transaction_id)
        .one()
    )
    assert txn.transaction_type == "spending"
    assert txn.amount == -50


def test_request_redeem_creates_pending_with_points_deducted(db_session, student_seq):
    cat = _make_category(db_session, name="Experiences")
    item = _make_item(db_session, cat, fulfillment_type="request", cost_points=30)
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 30)

    redemption, sp = shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.commit()

    assert redemption.status == "pending"
    assert sp.current_balance == 0
    assert sp.total_spent == 30


def test_insufficient_balance_raises_and_rolls_back(db_session, student_seq):
    cat = _make_category(db_session)
    item = _make_item(db_session, cat, cost_points=100)
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 10)

    with pytest.raises(ValueError):
        shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.rollback()

    sp = (
        db_session.query(StudentPoints)
        .filter(StudentPoints.student_id == student.id)
        .one()
    )
    assert sp.current_balance == 10
    assert sp.total_spent == 0
    assert (
        db_session.query(PointTransaction)
        .filter(PointTransaction.student_id == student.id)
        .count()
        == 0
    )


def test_sold_out_raises_unlimited_never_decrements(db_session, student_seq):
    cat = _make_category(db_session)
    # Limited, zero stock.
    sold_out = _make_item(db_session, cat, cost_points=10, quantity_available=0)
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    with pytest.raises(ValueError):
        shop_crud.redeem_item(db_session, student.id, sold_out.id)
    db_session.rollback()

    # Unlimited item: redeem twice, quantity stays None.
    unlimited = _make_item(
        db_session, cat, name="Unlimited", cost_points=10, quantity_available=None
    )
    shop_crud.redeem_item(db_session, student.id, unlimited.id)
    db_session.commit()
    shop_crud.redeem_item(db_session, student.id, unlimited.id)
    db_session.commit()
    db_session.refresh(unlimited)
    assert unlimited.quantity_available is None
    assert unlimited.total_redeemed == 2


def test_snapshot_survives_rename_reprice_delete(db_session, student_seq):
    cat = _make_category(db_session)
    item = _make_item(db_session, cat, name="Original", cost_points=40)
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    redemption, _ = shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.commit()
    rid = redemption.id

    # Rename + reprice.
    item.name = "Renamed"
    item.cost_points = 999
    db_session.commit()

    fresh = shop_crud.get_redemption(db_session, rid)
    assert fresh.item_name == "Original"
    assert fresh.cost_points == 40

    # Delete the item — snapshot survives, item_id goes NULL.
    db_session.delete(item)
    db_session.commit()
    db_session.expire_all()
    fresh = shop_crud.get_redemption(db_session, rid)
    assert fresh.item_name == "Original"
    assert fresh.item_id is None


def test_decline_refund_math(db_session, student_seq):
    cat = _make_category(db_session, name="Experiences")
    item = _make_item(
        db_session,
        cat,
        fulfillment_type="request",
        cost_points=60,
        quantity_available=3,
    )
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    redemption, _ = shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.commit()
    db_session.refresh(item)
    assert item.quantity_available == 2  # decremented on redeem

    declined = shop_crud.decline_redemption(db_session, redemption, admin_id=None)
    db_session.commit()

    assert declined.status == "declined"
    sp = (
        db_session.query(StudentPoints)
        .filter(StudentPoints.student_id == student.id)
        .one()
    )
    # Exact restore.
    assert sp.current_balance == 100
    assert sp.total_spent == 0

    # Restocked (limited item).
    db_session.refresh(item)
    assert item.quantity_available == 3

    refund = (
        db_session.query(PointTransaction)
        .filter(PointTransaction.id == declined.refund_transaction_id)
        .one()
    )
    assert refund.transaction_type == "refund"
    assert refund.amount == 60


def test_decline_total_spent_guard_and_unlimited_no_restock(db_session, student_seq):
    cat = _make_category(db_session, name="Experiences")
    item = _make_item(
        db_session,
        cat,
        fulfillment_type="request",
        cost_points=50,
        quantity_available=None,
    )
    student = _make_student(db_session, next(student_seq))
    # Give exactly enough; then artificially zero total_spent to test max(0,...).
    _give_points(db_session, student.id, 50)

    redemption, _ = shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.commit()

    sp = (
        db_session.query(StudentPoints)
        .filter(StudentPoints.student_id == student.id)
        .one()
    )
    sp.total_spent = 0  # simulate drift; decline must not go negative
    db_session.commit()

    shop_crud.decline_redemption(db_session, redemption, admin_id=None)
    db_session.commit()

    db_session.refresh(sp)
    assert sp.total_spent == 0  # max(0, 0-50)
    db_session.refresh(item)
    assert item.quantity_available is None  # unlimited never restocks


def test_state_machine_guards(db_session, student_seq):
    cat = _make_category(db_session, name="Experiences")
    item = _make_item(db_session, cat, fulfillment_type="request", cost_points=10)
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    redemption, _ = shop_crud.redeem_item(db_session, student.id, item.id)
    db_session.commit()

    # Cannot fulfill a pending redemption.
    with pytest.raises(ValueError):
        shop_crud.fulfill_redemption(db_session, redemption)
    db_session.rollback()

    # Approve pending -> ready.
    shop_crud.approve_redemption(db_session, redemption, admin_id=None)
    # Cannot decline a ready redemption.
    with pytest.raises(ValueError):
        shop_crud.decline_redemption(db_session, redemption, admin_id=None)
    db_session.rollback()

    # Fulfill ready -> fulfilled.
    shop_crud.fulfill_redemption(db_session, redemption)
    # Cannot approve a fulfilled redemption.
    with pytest.raises(ValueError):
        shop_crud.approve_redemption(db_session, redemption, admin_id=None)
    db_session.rollback()


def test_admin_queue_excludes_instant(db_session, student_seq):
    cat = _make_category(db_session)
    instant = _make_item(db_session, cat, fulfillment_type="instant", cost_points=10)
    request = _make_item(
        db_session, cat, name="Req", fulfillment_type="request", cost_points=10
    )
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    shop_crud.redeem_item(db_session, student.id, instant.id)
    db_session.commit()
    shop_crud.redeem_item(db_session, student.id, request.id)
    db_session.commit()

    pending = shop_crud.get_admin_redemptions(db_session, "pending")
    # Tables persist across the session, so scope the assertion to this student.
    mine = [r for r in pending if r.student_id == student.id]
    assert len(mine) == 1
    assert mine[0].fulfillment_type == "request"
    # Instant redemptions never appear in the pending/ready approval queues.
    assert all(r.fulfillment_type == "request" for r in pending)


def test_history_includes_instant_and_completed_requests(db_session, student_seq):
    cat = _make_category(db_session)
    instant = _make_item(db_session, cat, fulfillment_type="instant", cost_points=10)
    request = _make_item(
        db_session, cat, name="Req", fulfillment_type="request", cost_points=10
    )
    student = _make_student(db_session, next(student_seq))
    _give_points(db_session, student.id, 100)

    # Instant redemption is auto-"redeemed".
    instant_r, _ = shop_crud.redeem_item(db_session, student.id, instant.id)
    db_session.commit()
    # Request redemption walked through to fulfilled.
    request_r, _ = shop_crud.redeem_item(db_session, student.id, request.id)
    db_session.commit()
    shop_crud.approve_redemption(db_session, request_r, admin_id=None)
    shop_crud.fulfill_redemption(db_session, request_r)
    db_session.commit()

    history = shop_crud.get_admin_redemptions(db_session, "history")
    mine = {r.id: r for r in history if r.student_id == student.id}
    # Both the auto-fulfilled instant and the fulfilled request appear.
    assert instant_r.id in mine
    assert mine[instant_r.id].status == "redeemed"
    assert request_r.id in mine
    assert mine[request_r.id].status == "fulfilled"


def test_reorder_items_sets_display_order(db_session, student_seq):
    cat = _make_category(db_session)
    a = _make_item(db_session, cat, name="A")
    b = _make_item(db_session, cat, name="B")
    c = _make_item(db_session, cat, name="C")

    ordered = shop_crud.reorder_items(db_session, [c.id, a.id, b.id])
    positions = {i.id: i.display_order for i in ordered}
    assert positions[c.id] == 0
    assert positions[a.id] == 1
    assert positions[b.id] == 2

    # get_items honors the new order (scoped to this category).
    listed = [i for i in shop_crud.get_items(db_session) if i.category_id == cat.id]
    assert [i.id for i in listed] == [c.id, a.id, b.id]


def test_set_student_goal_valid_invalid_and_clear(db_session, student_seq):
    cat = _make_category(db_session)
    item = _make_item(db_session, cat, name="Goal")
    hidden = _make_item(db_session, cat, name="Hidden", is_active=False)
    student = _make_student(db_session, next(student_seq))

    # Valid goal.
    sp = shop_crud.set_student_goal(db_session, student.id, item.id)
    assert sp.goal_item_id == item.id

    # Clearing.
    sp = shop_crud.set_student_goal(db_session, student.id, None)
    assert sp.goal_item_id is None

    # Inactive item is rejected.
    with pytest.raises(LookupError):
        shop_crud.set_student_goal(db_session, student.id, hidden.id)
    db_session.rollback()

    # Missing item is rejected.
    with pytest.raises(LookupError):
        shop_crud.set_student_goal(db_session, student.id, 999999)
    db_session.rollback()


# --- Image seam --------------------------------------------------------------


def _png_bytes(size=(50, 50), mode="RGB", color=(200, 100, 50)):
    img = Image.new(mode, size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_process_upload_downscales_large_image():
    raw = _png_bytes(size=(2000, 1000))
    data, mime = image_storage.process_upload(raw)
    out = Image.open(io.BytesIO(data))
    assert max(out.size) == image_storage.MAX_EDGE
    assert mime in ("image/jpeg", "image/png")


def test_process_upload_rejects_garbage():
    with pytest.raises(ValueError):
        image_storage.process_upload(b"this is not an image")


def test_process_upload_preserves_alpha_as_png():
    raw = _png_bytes(size=(100, 100), mode="RGBA", color=(200, 100, 50, 128))
    data, mime = image_storage.process_upload(raw)
    assert mime == "image/png"


def test_store_get_delete_round_trip(db_session):
    raw = _png_bytes(size=(100, 100))
    data, mime = image_storage.process_upload(raw)
    external_id = image_storage.store_image(db_session, data, mime)
    db_session.commit()

    got = image_storage.get_image(db_session, external_id)
    assert got is not None
    got_data, got_mime = got
    assert got_data == data
    assert got_mime == mime

    assert image_storage.delete_image(db_session, external_id) is True
    db_session.commit()
    assert image_storage.get_image(db_session, external_id) is None
    assert image_storage.delete_image(db_session, external_id) is False
