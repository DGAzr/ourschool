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

"""Backup export → wipe → import round-trip for Paperless integration data.

Covers the whole Paperless backup surface: tag/doctype mappings (including a
manual remap, which must survive with auto_matched=False), the document
metadata cache (external_id preserved so thumbnail URLs stay valid), and all
three attachment link tables. The connection row is not backed up by design;
it must survive the wipe untouched so the integration stays connected.
"""

import uuid

import pytest

from app.services import paperless_client
from test_paperless import BASE, FakePaperlessClient, make_library


@pytest.fixture()
def connected(client, admin_headers, monkeypatch):
    """Two subjects + a connected fake Paperless server (initial sync ran)."""
    tok = uuid.uuid4().hex[:8]
    math_name = f"Math-{tok}"
    sci_name = f"Science-{tok}"
    subjects = {}
    for name in (math_name, sci_name):
        r = client.post("/api/subjects/", json={"name": name}, headers=admin_headers)
        assert r.status_code == 200, r.text
        subjects[name] = r.json()

    library = make_library(math_name, sci_name)
    fake = FakePaperlessClient(**library)
    monkeypatch.setattr(paperless_client, "create_client", lambda url, token: fake)

    r = client.post(
        f"{BASE}/connect",
        json={"url": "http://paperless.fake:8000", "token": f"token-{tok}-abcd"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return {
        "math": subjects[math_name],
        "sci": subjects[sci_name],
        "library": library,
    }


def _doc_by_pid(client, admin_headers, paperless_id):
    """Find a cached document (as the API shows it) by its paperless id."""
    r = client.get(f"{BASE}/documents?limit=500", headers=admin_headers)
    assert r.status_code == 200, r.text
    for item in r.json()["items"]:
        if item["paperless_id"] == paperless_id:
            return item
    raise AssertionError(f"document {paperless_id} not in cache")


def test_paperless_backup_round_trip(
    client, admin_headers, classroom, student_factory, assign, connected
):
    library = connected["library"]
    doc_lesson = _doc_by_pid(client, admin_headers, library["documents"][0]["id"])
    doc_template = _doc_by_pid(client, admin_headers, library["documents"][1]["id"])
    doc_assignment = _doc_by_pid(client, admin_headers, library["documents"][2]["id"])

    # Manually remap the "Unrelated" tag onto the science subject — manual
    # mappings are exactly what the backup must preserve.
    unrelated_tag = library["tags"][2]
    r = client.patch(
        f"{BASE}/settings",
        json={
            "tag_maps": [
                {
                    "paperless_tag_id": unrelated_tag["id"],
                    "subject_id": connected["sci"]["id"],
                }
            ]
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # Attach one document at each level: lesson, template, assignment instance.
    r = client.post(
        "/api/lessons/",
        json={"title": "Paperless Backup Lesson", "date": "2026-03-16"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc_lesson["id"]},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    template = classroom["template"]
    r = client.post(
        f"{BASE}/templates/{template['id']}/materials",
        json={"document_id": doc_template["id"]},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    student, _ = student_factory()
    sa = assign(template["id"], student["id"], due_date="2026-03-20")
    r = client.post(
        f"{BASE}/student-assignments/{sa['id']}/materials",
        json={"document_id": doc_assignment["id"]},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    # Export: every Paperless section must be populated.
    r = client.get("/api/backup/export", headers=admin_headers)
    assert r.status_code == 200, r.text
    backup = r.json()
    our_pids = {d["id"] for d in library["documents"]}
    exported_docs = [
        d for d in backup["paperless_documents"] if d["paperless_id"] in our_pids
    ]
    assert len(exported_docs) == 4
    exported_tag = [
        m
        for m in backup["paperless_tag_maps"]
        if m["paperless_tag_id"] == unrelated_tag["id"]
    ]
    assert exported_tag[0]["auto_matched"] is False
    assert exported_tag[0]["subject_name"] == connected["sci"]["name"]
    assert any(
        link["lesson_external_id"] == lesson["external_id"]
        for link in backup["lesson_paperless_materials"]
    )
    assert any(
        link["document_paperless_id"] == doc_template["paperless_id"]
        for link in backup["template_paperless_materials"]
    )
    assert any(
        link["document_paperless_id"] == doc_assignment["paperless_id"]
        and link["student_email"] == student["email"]
        for link in backup["student_assignment_paperless_materials"]
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

    # The connection is not backup-scoped and must survive the wipe.
    r = client.get(f"{BASE}/status", headers=admin_headers)
    assert r.status_code == 200, r.text
    status = r.json()
    assert status["connected"] is True
    restored_tag = [
        m for m in status["tag_maps"] if m["paperless_tag_id"] == unrelated_tag["id"]
    ]
    assert restored_tag[0]["auto_matched"] is False
    assert restored_tag[0]["subject_id"] is not None

    # Documents restored with their capability external_ids intact.
    restored_doc = _doc_by_pid(client, admin_headers, doc_lesson["paperless_id"])
    assert restored_doc["external_id"] == doc_lesson["external_id"]

    # Lesson attachment survived (lesson matched by external_id).
    r = client.get(
        "/api/lessons/?start_date=2026-03-16&end_date=2026-03-16",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    restored_lessons = [
        row for row in r.json() if row["external_id"] == lesson["external_id"]
    ]
    assert len(restored_lessons) == 1
    materials = restored_lessons[0]["paperless_materials"]
    assert [m["title"] for m in materials] == [doc_lesson["title"]]
    assert materials[0]["external_id"] == doc_lesson["external_id"]

    # Template attachment survived (template matched by name after re-create).
    r = client.get("/api/assignments/templates", headers=admin_headers)
    assert r.status_code == 200, r.text
    restored_template = [t for t in r.json() if t["name"] == template["name"]][0]
    assert [m["title"] for m in restored_template["paperless_materials"]] == [
        doc_template["title"]
    ]

    # Assignment-instance attachment survived, keyed by (student, template,
    # due_date).
    r = client.get(
        f"/api/assignments/templates/{restored_template['id']}/assignments",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    restored_sa = r.json()[0]
    assert [m["title"] for m in restored_sa["paperless_materials"]] == [
        doc_assignment["title"]
    ]


def test_paperless_import_into_empty_system_skips_cleanly(
    client, admin_headers, connected
):
    """A backup with attachments whose parents are missing degrades to skips,
    never errors (mirrors the SET NULL/skip contracts elsewhere)."""
    r = client.get("/api/backup/export", headers=admin_headers)
    assert r.status_code == 200, r.text
    backup = r.json()

    # Point a lesson attachment at a lesson that will not exist on import.
    backup["lesson_paperless_materials"] = [
        {
            "lesson_external_id": str(uuid.uuid4()),
            "document_paperless_id": connected["library"]["documents"][0]["id"],
            "title": "Orphan",
            "material_kind": "other",
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]

    r = client.post(
        "/api/backup/import",
        json={"backup_data": backup, "import_options": {}},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True, body
    assert body["errors"] == [], body["errors"]
    assert body["imported_counts"]["lesson_paperless_materials"] == 0
