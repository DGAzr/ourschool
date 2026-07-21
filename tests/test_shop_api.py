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

"""API-level tests for the Points Shop router."""

import io

import pytest
from PIL import Image

from app.crud import points as points_crud


def _award_points(client, admin_headers, student_id, amount):
    r = client.post(
        "/api/points/adjust",
        json={"student_id": student_id, "amount": amount, "notes": "test grant"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text


def _create_category(client, admin_headers, name):
    r = client.post(
        "/api/shop/categories",
        json={"name": name, "color": "#C0892F", "icon": "🍩"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _create_item(client, admin_headers, category_id, **kwargs):
    payload = {
        "name": "Cookie",
        "category_id": category_id,
        "description": "Tasty",
        "cost_points": 50,
        "quantity_available": None,
        "fulfillment_type": "instant",
        "is_active": True,
        "image_ids": [],
    }
    payload.update(kwargs)
    r = client.post("/api/shop/items", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()


def _png_bytes(size=(60, 60)):
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 100, 50)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def _points_enabled(db_session):
    points_crud.update_system_setting(db_session, "points_system_enabled", "true")
    yield


def test_points_disabled_returns_403(client, admin_headers, db_session):
    points_crud.update_system_setting(db_session, "points_system_enabled", "false")
    try:
        r = client.get("/api/shop/categories", headers=admin_headers)
        assert r.status_code == 403
    finally:
        points_crud.update_system_setting(db_session, "points_system_enabled", "true")


def test_category_crud_and_delete_block(client, admin_headers, _points_enabled):
    cat = _create_category(client, admin_headers, "CatCrud")

    # Update.
    r = client.put(
        f"/api/shop/categories/{cat['id']}",
        json={"name": "CatCrudRenamed"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "CatCrudRenamed"

    # Item referencing it blocks delete.
    _create_item(client, admin_headers, cat["id"], name="Blocker")
    r = client.delete(f"/api/shop/categories/{cat['id']}", headers=admin_headers)
    assert r.status_code == 400

    # Empty category deletes fine.
    empty = _create_category(client, admin_headers, "EmptyCat")
    r = client.delete(f"/api/shop/categories/{empty['id']}", headers=admin_headers)
    assert r.status_code == 200


def test_student_sees_only_active_items(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "ActiveCat")
    _create_item(client, admin_headers, cat["id"], name="Visible", is_active=True)
    hidden = _create_item(
        client, admin_headers, cat["id"], name="Hidden", is_active=False
    )

    _, student_headers = student_factory()
    r = client.get(f"/api/shop/items?category_id={cat['id']}", headers=student_headers)
    assert r.status_code == 200
    names = {i["name"] for i in r.json()}
    assert "Visible" in names
    assert "Hidden" not in names

    # Hidden item detail 404s for the student.
    r = client.get(f"/api/shop/items/{hidden['id']}", headers=student_headers)
    assert r.status_code == 404


def test_redeem_success_and_insufficient(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "RedeemCat")
    item = _create_item(
        client, admin_headers, cat["id"], cost_points=30, fulfillment_type="instant"
    )
    student, student_headers = student_factory()
    _award_points(client, admin_headers, student["id"], 100)

    r = client.post(
        "/api/shop/redeem", json={"item_id": item["id"]}, headers=student_headers
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["redemption"]["status"] == "redeemed"
    assert body["student_points"]["current_balance"] == 70

    # Expensive item -> 400 insufficient.
    pricey = _create_item(
        client, admin_headers, cat["id"], name="Pricey", cost_points=1000
    )
    r = client.post(
        "/api/shop/redeem", json={"item_id": pricey["id"]}, headers=student_headers
    )
    assert r.status_code == 400


def test_redeem_rejects_admin_token(client, admin_headers, _points_enabled):
    cat = _create_category(client, admin_headers, "AdminRedeemCat")
    item = _create_item(client, admin_headers, cat["id"])
    r = client.post(
        "/api/shop/redeem", json={"item_id": item["id"]}, headers=admin_headers
    )
    assert r.status_code == 403


def test_full_request_queue_flow_with_refund(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "QueueCat")
    item = _create_item(
        client,
        admin_headers,
        cat["id"],
        name="Outing",
        cost_points=40,
        fulfillment_type="request",
    )
    student, student_headers = student_factory()
    _award_points(client, admin_headers, student["id"], 100)

    # Redeem -> pending, points held.
    r = client.post(
        "/api/shop/redeem", json={"item_id": item["id"]}, headers=student_headers
    )
    assert r.status_code == 200
    redemption_id = r.json()["redemption"]["id"]
    assert r.json()["student_points"]["current_balance"] == 60

    # Appears in the pending queue.
    r = client.get("/api/shop/redemptions?status=pending", headers=admin_headers)
    ids = {x["id"] for x in r.json()}
    assert redemption_id in ids

    # Approve -> ready.
    r = client.post(
        f"/api/shop/redemptions/{redemption_id}/approve", headers=admin_headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ready"

    # Fulfill -> fulfilled.
    r = client.post(
        f"/api/shop/redemptions/{redemption_id}/fulfill", headers=admin_headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "fulfilled"

    # Cannot re-approve a fulfilled row (409).
    r = client.post(
        f"/api/shop/redemptions/{redemption_id}/approve", headers=admin_headers
    )
    assert r.status_code == 409

    # History includes the fulfilled request (instant redeemed rows also land
    # here, so we no longer assert request-only).
    r = client.get("/api/shop/redemptions?status=history", headers=admin_headers)
    assert redemption_id in {x["id"] for x in r.json()}


def test_decline_refunds_points(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "DeclineCat")
    item = _create_item(
        client,
        admin_headers,
        cat["id"],
        name="Trip",
        cost_points=25,
        fulfillment_type="request",
    )
    student, student_headers = student_factory()
    _award_points(client, admin_headers, student["id"], 50)

    r = client.post(
        "/api/shop/redeem", json={"item_id": item["id"]}, headers=student_headers
    )
    redemption_id = r.json()["redemption"]["id"]

    # Balance held at 25.
    r = client.get("/api/points/my-balance", headers=student_headers)
    assert r.json()["current_balance"] == 25

    # Decline -> refund.
    r = client.post(
        f"/api/shop/redemptions/{redemption_id}/decline", headers=admin_headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "declined"

    r = client.get("/api/points/my-balance", headers=student_headers)
    assert r.json()["current_balance"] == 50
    assert r.json()["total_spent"] == 0


def test_image_upload_get_and_etag(client, admin_headers, _points_enabled):
    files = {"file": ("photo.png", _png_bytes(), "image/png")}
    r = client.post("/api/shop/images", files=files, headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    image_id = body["id"]
    assert "/api/shop/images/" in body["url"]

    # GET works without auth (capability URL).
    r = client.get(f"/api/shop/images/{image_id}")
    assert r.status_code == 200
    assert r.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    etag = r.headers["ETag"]

    # If-None-Match -> 304.
    r = client.get(f"/api/shop/images/{image_id}", headers={"If-None-Match": etag})
    assert r.status_code == 304

    # Unknown id -> 404.
    r = client.get("/api/shop/images/does-not-exist")
    assert r.status_code == 404


def test_image_upload_requires_admin(client, student_factory, _points_enabled):
    _, student_headers = student_factory()
    files = {"file": ("photo.png", _png_bytes(), "image/png")}
    r = client.post("/api/shop/images", files=files, headers=student_headers)
    assert r.status_code == 403


def test_overview_counts(client, admin_headers, _points_enabled):
    r = client.get("/api/shop/admin/overview", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert "pending_redemptions" in body
    assert "ready_redemptions" in body
    assert "student_goals" in body


def test_overview_lists_student_goals(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "OverviewGoalCat")
    item = _create_item(
        client, admin_headers, cat["id"], name="Telescope", cost_points=500
    )
    student, student_headers = student_factory()
    _award_points(client, admin_headers, student["id"], 120)
    client.put(
        "/api/shop/my-goal", json={"item_id": item["id"]}, headers=student_headers
    )

    r = client.get("/api/shop/admin/overview", headers=admin_headers)
    assert r.status_code == 200
    goals = r.json()["student_goals"]
    mine = next(g for g in goals if g["item_name"] == "Telescope")
    assert mine["student_id"] == student["id"]
    assert mine["cost_points"] == 500
    assert mine["current_balance"] == 120
    assert mine["remaining"] == 380
    assert student["first_name"] in mine["student_name"]


def test_reorder_items_endpoint(client, admin_headers, _points_enabled):
    cat = _create_category(client, admin_headers, "ReorderCat")
    a = _create_item(client, admin_headers, cat["id"], name="OrderA")
    b = _create_item(client, admin_headers, cat["id"], name="OrderB")
    c = _create_item(client, admin_headers, cat["id"], name="OrderC")

    r = client.put(
        "/api/shop/items/reorder",
        json={"item_ids": [c["id"], a["id"], b["id"]]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # The list endpoint now returns them in the requested order (scoped to cat).
    r = client.get(f"/api/shop/items?category_id={cat['id']}", headers=admin_headers)
    listed = [i["id"] for i in r.json()]
    assert listed == [c["id"], a["id"], b["id"]]


def test_set_my_goal_endpoint(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "GoalCat")
    item = _create_item(client, admin_headers, cat["id"], name="GoalItem")
    hidden = _create_item(
        client, admin_headers, cat["id"], name="GoalHidden", is_active=False
    )
    student, student_headers = student_factory()

    # Set a valid goal — echoed on the balance payload.
    r = client.put(
        "/api/shop/my-goal", json={"item_id": item["id"]}, headers=student_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["goal_item_id"] == item["id"]

    # It survives a fresh balance fetch.
    r = client.get("/api/points/my-balance", headers=student_headers)
    assert r.json()["goal_item_id"] == item["id"]

    # Clearing works.
    r = client.put(
        "/api/shop/my-goal", json={"item_id": None}, headers=student_headers
    )
    assert r.status_code == 200
    assert r.json()["goal_item_id"] is None

    # Hidden / missing items are rejected.
    r = client.put(
        "/api/shop/my-goal", json={"item_id": hidden["id"]}, headers=student_headers
    )
    assert r.status_code == 404
    r = client.put(
        "/api/shop/my-goal", json={"item_id": 999999}, headers=student_headers
    )
    assert r.status_code == 404


def test_admin_overview_surfaces_student_goal(
    client, admin_headers, student_factory, _points_enabled
):
    cat = _create_category(client, admin_headers, "AdminGoalCat")
    item = _create_item(client, admin_headers, cat["id"], name="AdminGoalItem")
    student, student_headers = student_factory()

    client.put(
        "/api/shop/my-goal", json={"item_id": item["id"]}, headers=student_headers
    )

    r = client.get("/api/points/admin/overview", headers=admin_headers)
    assert r.status_code == 200
    mine = next(
        sp for sp in r.json()["student_points"] if sp["student_id"] == student["id"]
    )
    assert mine["goal_item_id"] == item["id"]
    assert mine["goal_item_name"] == "AdminGoalItem"
