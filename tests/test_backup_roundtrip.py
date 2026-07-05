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


def _add_attendance(client, admin_headers, student_id, day):
    r = client.post(
        "/api/attendance/",
        json={"student_id": student_id, "date": day, "status": "present"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _attendance_dates(client, admin_headers, student_id):
    r = client.get(
        "/api/attendance/",
        params={
            "student_id": student_id,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return {rec["date"] for rec in r.json()}


def test_wipe_requires_typed_confirmation(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()
    _add_attendance(client, admin_headers, student["id"], "2026-03-11")
    backup = _export(client, admin_headers)

    # Missing confirmation
    r = client.post(
        "/api/backup/import",
        json={"backup_data": backup, "import_options": {"wipe_before_import": True}},
        headers=admin_headers,
    )
    assert r.status_code == 400

    # Wrong confirmation
    r = client.post(
        "/api/backup/import",
        json={
            "backup_data": backup,
            "import_options": {"wipe_before_import": True},
            "wipe_confirmation": "wipe all data",
        },
        headers=admin_headers,
    )
    assert r.status_code == 400

    # Nothing was touched
    assert "2026-03-11" in _attendance_dates(client, admin_headers, student["id"])


def test_wipe_dry_run_counts_without_deleting(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()
    _add_attendance(client, admin_headers, student["id"], "2026-03-12")
    backup = _export(client, admin_headers)

    r = client.post(
        "/api/backup/import",
        json={
            "backup_data": backup,
            "import_options": {"wipe_before_import": True, "dry_run": True},
            "wipe_confirmation": "WIPE ALL DATA",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True, body
    assert body["dry_run"] is True
    assert body["deleted_counts"]["attendance_records"] >= 1
    assert body["deleted_counts"]["users"] >= 1  # the student, not the admin

    # Dry run deleted nothing
    assert "2026-03-12" in _attendance_dates(client, admin_headers, student["id"])


def test_wipe_and_restore_replaces_data_and_preserves_admin(
    client, admin_headers, classroom, student_factory, db_session
):
    from app.models.assignment_type import AssignmentTypeConfig
    from app.models.user import User

    student, _ = student_factory()
    _add_attendance(client, admin_headers, student["id"], "2026-03-13")
    backup = _export(client, admin_headers)

    admin_row = db_session.query(User).filter(User.username == "admin").one()
    password_hash_before = admin_row.hashed_password

    # Data created AFTER the export must disappear on wipe-restore.
    _add_attendance(client, admin_headers, student["id"], "2026-03-14")

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
    assert body["deleted_counts"]["attendance_records"] >= 2

    # Users were recreated from the backup; find the restored student by email.
    r = client.get("/api/users/students", headers=admin_headers)
    assert r.status_code == 200, r.text
    restored = [s for s in r.json() if s["email"] == student["email"]]
    assert restored, r.json()
    dates = _attendance_dates(client, admin_headers, restored[0]["id"])
    assert "2026-03-13" in dates  # in the backup: restored
    assert "2026-03-14" not in dates  # post-export: wiped

    # The importing admin kept their row and password hash...
    db_session.expire_all()
    admin_row = db_session.query(User).filter(User.username == "admin").one()
    assert admin_row.hashed_password == password_hash_before
    # ...and can still log in with the original password.
    r = client.post(
        "/api/auth/login", data={"username": "admin", "password": "adminpass123"}
    )
    assert r.status_code == 200, r.text

    # assignment_types are out of backup scope and must survive the wipe.
    assert (
        db_session.query(AssignmentTypeConfig)
        .filter(AssignmentTypeConfig.key == "homework")
        .first()
        is not None
    )


def test_wipe_rolls_back_fully_on_import_failure(
    client, admin_headers, classroom, student_factory, monkeypatch
):
    student, _ = student_factory()
    _add_attendance(client, admin_headers, student["id"], "2026-03-15")
    backup = _export(client, admin_headers)

    from app.routers.backup import importers

    def boom(*args, **kwargs):
        raise RuntimeError("simulated mid-import failure")

    monkeypatch.setattr(importers, "_import_subjects", boom)

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
    assert body["success"] is False
    assert body["errors"], body

    # The wipe rolled back with the failed import: pre-wipe data is intact.
    assert "2026-03-15" in _attendance_dates(client, admin_headers, student["id"])


def test_student_cannot_wipe(client, classroom, student_factory, admin_headers):
    _, student_headers = student_factory()
    backup = _export(client, admin_headers)
    r = client.post(
        "/api/backup/import",
        json={
            "backup_data": backup,
            "import_options": {"wipe_before_import": True},
            "wipe_confirmation": "WIPE ALL DATA",
        },
        headers=student_headers,
    )
    assert r.status_code == 403
