"""Backup export → import round-trip tests.

The importer's semantics are MERGE: existing records are matched (by
external_id, then natural keys) and skipped/updated; deleted records are
recreated from the backup. That restore path is what these tests exercise.
"""


def _export(client, admin_headers):
    r = client.get("/api/backup/export", headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_student_cannot_export_or_import(client, classroom, student_factory):
    _, student_headers = student_factory()
    assert client.get("/api/backup/export", headers=student_headers).status_code == 403


def test_dry_run_reports_success_without_changes(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    assign(classroom["template"]["id"], student["id"])
    backup = _export(client, admin_headers)

    r = client.post(
        "/api/backup/import",
        json={"backup_data": backup, "import_options": {"dry_run": True}},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True, body
    assert body["dry_run"] is True
    assert body["errors"] == [], body["errors"]


def test_deleted_records_are_restored_by_import(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    sa = assign(classroom["template"]["id"], student["id"], due_date="2026-04-01")

    # Grade it and record attendance so the backup carries real academic data.
    r = client.post(
        f"/api/assignments/student-assignments/{sa['id']}/grade",
        json={"points_earned": 95},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    r = client.post(
        "/api/attendance/",
        json={"student_id": student["id"], "date": "2026-03-10", "status": "present"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    attendance_id = r.json()["id"]

    backup = _export(client, admin_headers)

    # Simulate data loss.
    r = client.delete(f"/api/attendance/{attendance_id}", headers=admin_headers)
    assert r.status_code == 200, r.text
    r = client.delete(
        f"/api/assignments/student-assignments/{sa['id']}", headers=admin_headers
    )
    assert r.status_code == 200, r.text

    # Restore.
    r = client.post(
        "/api/backup/import",
        json={"backup_data": backup},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True, body
    assert body["errors"] == [], body["errors"]

    # Attendance record is back with the same content.
    r = client.get(
        "/api/attendance/",
        params={"student_id": student["id"], "start_date": "2026-03-10", "end_date": "2026-03-10"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    records = r.json()
    assert any(
        rec["date"] == "2026-03-10" and rec["status"] == "present" for rec in records
    ), records

    # The graded assignment is back with its grade intact.
    r = client.get(
        f"/api/assignments/students/{student['id']}/assignments",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assignments = r.json()
    restored = [a for a in assignments if a["is_graded"]]
    assert restored, assignments
    assert restored[0]["points_earned"] == 95
