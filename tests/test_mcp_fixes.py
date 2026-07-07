"""Regression tests for issues found during MCP API testing (2026-07).

Covers: term-report ORM leak, sticky EXCUSED status, derived overdue filter,
archived-template assign guard, single-template stats, grade-date backfill,
null (not F) grades for ungraded subjects, points attribution, and journal
pagination.
"""
import json


def _grade(client, headers, assignment_id, points, **extra):
    return client.post(
        f"/api/assignments/student-assignments/{assignment_id}/grade",
        json={"points_earned": points, **extra},
        headers=headers,
    )


def test_term_grade_report_has_no_user_secrets(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    # Due date inside the classroom term so the grade lands in *this* term
    # regardless of terms created by other test files.
    sa = assign(classroom["template"]["id"], student["id"], due_date="2026-06-01")
    assert _grade(client, admin_headers, sa["id"], 90).status_code == 200

    term_id = classroom["term"]["id"]
    r = client.post(
        f"/api/terms/{term_id}/calculate-grades", headers=admin_headers
    )
    assert r.status_code == 200, r.text

    r = client.get(f"/api/terms/{term_id}/grade-report", headers=admin_headers)
    assert r.status_code == 200, r.text
    raw = json.dumps(r.json())
    assert "hashed_password" not in raw
    assert "external_id" not in raw
    report = r.json()
    assert report["total_students"] >= 1
    assert any(
        s["student"]["id"] == student["id"] for s in report["students"]
    )

    r = client.get(
        f"/api/terms/{term_id}/students/{student['id']}/report",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    raw = json.dumps(r.json())
    assert "hashed_password" not in raw
    assert "external_id" not in raw


def test_excused_status_is_settable_and_sticky(
    client, admin_headers, classroom, student_factory, assign
):
    student, student_headers = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"status": "excused"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "excused"

    # A later touch (e.g. editing notes) must not silently un-excuse it.
    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"student_notes": "still excused"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "excused"

    # Explicitly setting another status un-excuses (recomputed from state).
    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"status": "not_started"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] != "excused"

    # Students may not excuse their own assignments.
    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"status": "excused"},
        headers=student_headers,
    )
    assert r.status_code == 403, r.text


def test_overdue_status_filter_is_derived_from_due_dates(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    overdue = assign(
        classroom["template"]["id"], student["id"], due_date="2026-02-01"
    )
    not_due = assign(
        classroom["template"]["id"], student["id"], due_date="2099-01-01"
    )

    r = client.get(
        "/api/assignments/all-assignments",
        params={"status": "overdue", "student_id": student["id"]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    ids = {a["id"] for a in r.json()}
    assert overdue["id"] in ids
    assert not_due["id"] not in ids

    r = client.get(
        f"/api/assignments/students/{student['id']}/assignments",
        params={"status": "overdue"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert overdue["id"] in {a["id"] for a in r.json()}


def test_archived_template_cannot_be_assigned(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()
    template_id = classroom["template"]["id"]

    r = client.post(
        f"/api/assignments/templates/{template_id}/archive", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_archived"] is True

    r = client.post(
        "/api/assignments/assign",
        json={"template_id": template_id, "student_ids": [student["id"]]},
        headers=admin_headers,
    )
    assert r.status_code == 400, r.text

    # Unarchive (toggle) so other fixtures are unaffected.
    r = client.post(
        f"/api/assignments/templates/{template_id}/archive", headers=admin_headers
    )
    assert r.json()["is_archived"] is False


def test_single_template_stats_are_populated(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    template_id = classroom["template"]["id"]
    sa = assign(template_id, student["id"])
    assert _grade(client, admin_headers, sa["id"], 80).status_code == 200

    r = client.get(
        f"/api/assignments/templates/{template_id}", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Graded assignments still count as assigned (matches the delete guard).
    assert body["total_assigned"] >= 1
    assert body["average_grade"] is not None


def test_grading_unsubmitted_work_backfills_dates(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])
    assert sa["submitted_date"] is None

    r = _grade(client, admin_headers, sa["id"], 75)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "graded"
    assert body["started_date"] is not None
    assert body["submitted_date"] is not None
    assert body["completed_date"] is not None


def test_ungraded_subjects_report_null_not_f(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    # Assigned but nothing graded.
    assign(classroom["template"]["id"], student["id"])

    r = client.get("/api/reports/admin/student-progress", headers=admin_headers)
    assert r.status_code == 200, r.text
    row = next(p for p in r.json() if p["student_id"] == student["id"])
    assert row["overall_letter_grade"] is None
    assert row["overall_grade"] is None
    for subject in row["subjects"]:
        assert subject["letter_grade"] is None
        assert subject["average_percentage"] is None


def test_points_adjust_attribution_matches_ledger(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()

    r = client.post(
        "/api/points/adjust",
        json={"student_id": student["id"], "amount": 25, "notes": "attribution test"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    adjust = r.json()
    assert adjust["admin_name"]
    assert adjust["student_name"]

    r = client.get(
        f"/api/points/student/{student['id']}/ledger", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    ledger = r.json()
    row = next(
        t for t in ledger["transactions"] if t["notes"] == "attribution test"
    )
    # Same transaction, same attribution — no "API Integration" drift.
    assert row["admin_name"] == adjust["admin_name"]
    assert row["student_name"] == adjust["student_name"]

    r = client.get(
        f"/api/points/student/{student['id']}/balance", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["student_name"]


def test_journal_entries_are_paginated(
    client, admin_headers, student_factory
):
    student, student_headers = student_factory()
    for i in range(3):
        r = client.post(
            "/api/journal/entries",
            json={
                "student_id": student["id"],
                "title": f"Entry {i}",
                "content": f"Content {i}",
                "entry_date": f"2026-07-0{i + 1}",
            },
            headers=student_headers,
        )
        assert r.status_code in (200, 201), r.text

    r = client.get(
        "/api/journal/entries",
        params={"student_id": student["id"], "limit": 2},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 2

    r = client.get(
        "/api/journal/entries",
        params={"student_id": student["id"], "limit": 2, "skip": 2},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1
