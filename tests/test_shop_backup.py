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

"""Backup export → wipe → import round-trip for Points Shop data."""

import io

from PIL import Image

from app.crud import points as points_crud


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (70, 70), (200, 100, 50)).save(buf, format="PNG")
    return buf.getvalue()


def test_shop_backup_round_trip(client, admin_headers, student_factory, db_session):
    points_crud.update_system_setting(db_session, "points_system_enabled", "true")

    # Category.
    r = client.post(
        "/api/shop/categories",
        json={"name": "BackupCat", "color": "#4F7CAC", "icon": "🎟"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    category = r.json()

    # Image.
    files = {"file": ("p.png", _png_bytes(), "image/png")}
    r = client.post("/api/shop/images", files=files, headers=admin_headers)
    assert r.status_code == 200, r.text
    image_id = r.json()["id"]

    # Fetch the stored (processed) bytes for later comparison.
    original_bytes = client.get(f"/api/shop/images/{image_id}").content

    # Item referencing the image.
    r = client.post(
        "/api/shop/items",
        json={
            "name": "BackupItem",
            "category_id": category["id"],
            "description": "restore me",
            "cost_points": 20,
            "quantity_available": 5,
            "fulfillment_type": "request",
            "is_active": True,
            "image_ids": [image_id],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    item = r.json()

    # A second item, drag-ordered above the first (display_order must survive).
    r = client.post(
        "/api/shop/items",
        json={
            "name": "BackupItem2",
            "category_id": category["id"],
            "cost_points": 55,
            "fulfillment_type": "instant",
            "is_active": True,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    item2 = r.json()
    r = client.put(
        "/api/shop/items/reorder",
        json={"item_ids": [item2["id"], item["id"]]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # A student redemption (pending request) and a saving-toward goal.
    student, student_headers = student_factory()
    r = client.post(
        "/api/points/adjust",
        json={"student_id": student["id"], "amount": 100, "notes": "grant"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    r = client.post(
        "/api/shop/redeem", json={"item_id": item["id"]}, headers=student_headers
    )
    assert r.status_code == 200, r.text
    redemption_external = r.json()["redemption"]["external_id"]
    r = client.put(
        "/api/shop/my-goal", json={"item_id": item2["id"]}, headers=student_headers
    )
    assert r.status_code == 200, r.text

    # Export.
    r = client.get("/api/backup/export", headers=admin_headers)
    assert r.status_code == 200, r.text
    backup = r.json()
    assert any(c["name"] == "BackupCat" for c in backup["shop_categories"])
    assert any(i["name"] == "BackupItem" for i in backup["shop_items"])
    assert len(backup["shop_images"]) >= 1
    assert any(
        rd["external_id"] == redemption_external for rd in backup["shop_redemptions"]
    )

    # Wipe + import.
    r = client.post(
        "/api/backup/import",
        json={
            "backup_data": backup,
            "import_options": {"wipe_before_import": True},
            "wipe_confirmation": "WIPE ALL DATA",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True, body
    assert body["errors"] == [], body["errors"]

    # Category restored.
    r = client.get("/api/shop/categories", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert any(c["name"] == "BackupCat" for c in r.json())

    # Item restored with its image link and snapshotable fields.
    r = client.get("/api/shop/items", headers=admin_headers)
    assert r.status_code == 200, r.text
    all_items = r.json()
    items = [i for i in all_items if i["name"] == "BackupItem"]
    assert len(items) == 1
    restored_item = items[0]
    assert restored_item["cost_points"] == 20
    assert restored_item["fulfillment_type"] == "request"
    assert len(restored_item["image_ids"]) == 1

    # Drag order restored: BackupItem2 still sorts above BackupItem.
    names = [i["name"] for i in all_items if i["name"].startswith("BackupItem")]
    assert names == ["BackupItem2", "BackupItem"]

    # Saving-toward goal restored, remapped to the restored item.
    r = client.get("/api/points/my-balance", headers=student_headers)
    assert r.status_code == 200, r.text
    restored_item2 = next(i for i in all_items if i["name"] == "BackupItem2")
    assert r.json()["goal_item_id"] == restored_item2["id"]

    # Image bytes restored intact.
    restored_image_id = restored_item["image_ids"][0]
    r = client.get(f"/api/shop/images/{restored_image_id}")
    assert r.status_code == 200
    assert r.content == original_bytes

    # Redemption restored (external_id preserved, snapshot intact).
    r = client.get("/api/shop/my-redemptions", headers=student_headers)
    assert r.status_code == 200, r.text
    redemptions = [rd for rd in r.json() if rd["external_id"] == redemption_external]
    assert len(redemptions) == 1
    assert redemptions[0]["item_name"] == "BackupItem"
    assert redemptions[0]["cost_points"] == 20
    assert redemptions[0]["status"] == "pending"
