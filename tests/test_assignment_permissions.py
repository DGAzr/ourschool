"""Authorization tests for student-assignment endpoints.

Covers the student/admin split on PUT /student-assignments/{id} — in
particular the regression where students could rewrite their own due dates
and point denominators (fixed by STUDENT_EDITABLE_ASSIGNMENT_FIELDS).
"""


def test_student_cannot_change_own_due_date(client, classroom, student_factory, assign):
    student, student_headers = student_factory()
    sa = assign(classroom["template"]["id"], student["id"], due_date="2026-05-01")

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"due_date": "2099-01-01"},
        headers=student_headers,
    )
    assert r.status_code == 403, r.text
    assert "due_date" in r.json()["detail"]

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"extended_due_date": "2099-01-01"},
        headers=student_headers,
    )
    assert r.status_code == 403, r.text


def test_student_cannot_change_own_max_points(client, classroom, student_factory, assign):
    student, student_headers = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"custom_max_points": 1},
        headers=student_headers,
    )
    assert r.status_code == 403, r.text
    assert "custom_max_points" in r.json()["detail"]


def test_student_can_submit_own_assignment(client, classroom, student_factory, assign):
    student, student_headers = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"status": "submitted", "submission_notes": "done!"},
        headers=student_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "submitted"
    assert body["submitted_date"] is not None
    assert body["submission_notes"] == "done!"


def test_student_cannot_update_another_students_assignment(
    client, classroom, student_factory, assign
):
    student1, _ = student_factory()
    _, student2_headers = student_factory()
    sa = assign(classroom["template"]["id"], student1["id"])

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"student_notes": "not mine"},
        headers=student2_headers,
    )
    assert r.status_code == 403, r.text


def test_admin_can_change_due_date(client, admin_headers, classroom, student_factory, assign):
    student, _ = student_factory()
    sa = assign(classroom["template"]["id"], student["id"], due_date="2026-05-01")

    r = client.put(
        f"/api/assignments/student-assignments/{sa['id']}",
        json={"due_date": "2026-05-15", "custom_max_points": 50},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["due_date"] == "2026-05-15"
    assert body["custom_max_points"] == 50


def test_student_cannot_grade(client, classroom, student_factory, assign):
    student, student_headers = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    r = client.post(
        f"/api/assignments/student-assignments/{sa['id']}/grade",
        json={"points_earned": 100},
        headers=student_headers,
    )
    assert r.status_code == 403, r.text


def test_student_cannot_view_other_students_assignments(
    client, classroom, student_factory
):
    student1, _ = student_factory()
    _, student2_headers = student_factory()

    r = client.get(
        f"/api/assignments/students/{student1['id']}/assignments",
        headers=student2_headers,
    )
    assert r.status_code == 403, r.text
