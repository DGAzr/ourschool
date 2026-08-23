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

"""Backup export → wipe → import round-trip for Lesson Planner data."""


def test_lessons_backup_round_trip(client, admin_headers, classroom, student_factory):
    student, _ = student_factory()

    r = client.post(
        "/api/lessons/",
        json={
            "title": "Backup Lesson",
            "date": "2026-03-09",
            "subject_id": classroom["subject"]["id"],
            "objective": "Survive a restore",
            "duration_minutes": 30,
            "notes": "bring snacks",
            "student_ids": [student["id"]],
            "templates": [
                {
                    "template_id": classroom["template"]["id"],
                    "custom_max_points": 42,
                    "custom_instructions": "customized",
                }
            ],
            "materials": [
                {"label": "Glue", "is_gathered": True},
                {"label": "Paper", "is_gathered": False},
            ],
            "resources": [{"label": "Video", "url": "https://example.com/v"}],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]

    # A second lesson on the same day, marked taught, to cover status+position.
    r = client.post(
        "/api/lessons/",
        json={"title": "Taught Lesson", "date": "2026-03-09"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    taught_id = r.json()["lesson"]["id"]
    r = client.patch(
        f"/api/lessons/{taught_id}/status",
        json={"status": "taught"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # An unscheduled lesson exercises backup format 2.1's nullable placement
    # fields and former-date context.
    r = client.post(
        "/api/lessons/",
        json={"title": "Drawer Lesson", "date": "2026-03-08"},
        headers=admin_headers,
    )
    drawer_id = r.json()["lesson"]["id"]
    r = client.put(
        f"/api/lessons/{drawer_id}",
        json={"date": None},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # Export.
    r = client.get("/api/backup/export", headers=admin_headers)
    assert r.status_code == 200, r.text
    backup = r.json()
    assert backup["format_version"] == "2.1"
    drawer_export = next(l for l in backup["lessons"] if l["title"] == "Drawer Lesson")
    assert drawer_export["date"] is None
    assert drawer_export["last_scheduled_date"] == "2026-03-08"
    exported = [l for l in backup["lessons"] if l["title"] == "Backup Lesson"]
    assert len(exported) == 1
    assert exported[0]["subject_name"] == classroom["subject"]["name"]
    assert [s["student_email"] for s in exported[0]["students"]] == [student["email"]]
    assert exported[0]["templates"][0]["custom_max_points"] == 42

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

    # Both lessons restored on their day, in relative order (other tests may
    # have left unrelated lessons on the same date).
    r = client.get(
        "/api/lessons/?start_date=2026-03-09&end_date=2026-03-09",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    mine = [l for l in r.json() if l["title"] in ("Backup Lesson", "Taught Lesson")]
    assert [l["title"] for l in mine] == ["Backup Lesson", "Taught Lesson"]

    restored = mine[0]
    assert restored["external_id"] == lesson["external_id"]
    assert restored["objective"] == "Survive a restore"
    assert restored["duration_minutes"] == 30
    assert restored["notes"] == "bring snacks"
    assert restored["subject"]["name"] == classroom["subject"]["name"]
    assert [s["first_name"] for s in restored["students"]] == [student["first_name"]]
    assert [m["label"] for m in restored["materials"]] == ["Glue", "Paper"]
    assert [m["is_gathered"] for m in restored["materials"]] == [True, False]
    assert restored["resources"][0]["url"] == "https://example.com/v"

    link = restored["templates"][0]
    assert link["custom_max_points"] == 42
    assert link["custom_instructions"] == "customized"
    assert link["template"]["name"] == classroom["template"]["name"]

    assert mine[1]["status"] == "taught"

    drawer = client.get("/api/lessons/drawer", headers=admin_headers)
    assert drawer.status_code == 200
    restored_drawer = next(l for l in drawer.json() if l["title"] == "Drawer Lesson")
    assert restored_drawer["date"] is None
    assert restored_drawer["last_scheduled_date"] == "2026-03-08"
