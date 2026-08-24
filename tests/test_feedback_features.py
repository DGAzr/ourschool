"""Regression coverage for the August 2026 feedback features."""

from datetime import date


def test_kindergarten_grade_zero_survives_user_and_backup_apis(
    client, admin_headers, student_factory
):
    student, _ = student_factory()
    response = client.put(
        f"/api/users/{student['id']}",
        json={"grade_level": 0},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["grade_level"] == 0

    backup = client.get("/api/backup/export", headers=admin_headers)
    assert backup.status_code == 200, backup.text
    exported = next(
        user for user in backup.json()["users"] if user["email"] == student["email"]
    )
    assert exported["grade_level"] == 0

    for invalid_grade in (-1, 13):
        response = client.put(
            f"/api/users/{student['id']}",
            json={"grade_level": invalid_grade},
            headers=admin_headers,
        )
        assert response.status_code == 422


def test_student_creates_and_edits_private_assignment(
    client, classroom, student_factory, db_session, admin_headers
):
    from app.models.assignment import AssignmentTemplate, StudentAssignment

    student, headers = student_factory()
    response = client.post(
        "/api/assignments/my-assignments",
        headers=headers,
        json={
            "name": "Independent nature study",
            "subject_id": classroom["subject"]["id"],
            "assignment_type": "homework",
            "description": "Observe the garden",
            "instructions": "Write three observations",
            "max_points": 25,
            "estimated_duration_minutes": 45,
            "assigned_date": "2026-03-01",
            "due_date": "2026-03-05",
        },
    )
    assert response.status_code == 200, response.text
    assignment = response.json()
    assert assignment["is_student_created"] is True
    assert assignment["assigned_by"] == student["id"]
    assert assignment["template"]["is_library"] is False
    assert assignment["template"]["is_exportable"] is False

    response = client.put(
        f"/api/assignments/my-assignments/{assignment['id']}",
        headers=headers,
        json={"name": "Revised nature study", "max_points": 30},
    )
    assert response.status_code == 200, response.text
    assert response.json()["template"]["name"] == "Revised nature study"
    assert response.json()["template"]["max_points"] == 30

    db_session.expire_all()
    stored = db_session.query(StudentAssignment).filter_by(id=assignment["id"]).one()
    template = (
        db_session.query(AssignmentTemplate).filter_by(id=stored.template_id).one()
    )
    assert stored.is_student_created is True
    assert template.created_by == student["id"]

    backup = client.get("/api/backup/export", headers=admin_headers).json()
    exported_assignment = next(
        item
        for item in backup["student_assignments"]
        if item["student_email"] == student["email"]
        and item["assignment_template_name"] == "Revised nature study"
    )
    assert exported_assignment["is_student_created"] is True
    exported_template = next(
        item
        for item in backup["assignment_templates"]
        if item["name"] == "Revised nature study"
    )
    assert exported_template["is_library"] is False

    response = client.delete(
        f"/api/assignments/student-assignments/{assignment['id']}",
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    response = client.post(
        "/api/backup/import",
        json={"backup_data": backup},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    response = client.get("/api/assignments/my-assignments", headers=headers)
    restored = next(
        item
        for item in response.json()
        if item["template"]["name"] == "Revised nature study"
    )
    assert restored["is_student_created"] is True
    assert restored["template"]["is_library"] is False


def test_student_created_assignment_is_private_and_locks_at_submission(
    client, classroom, student_factory, admin_headers
):
    owner, owner_headers = student_factory()
    _, other_headers = student_factory()
    response = client.post(
        "/api/assignments/my-assignments",
        headers=owner_headers,
        json={
            "name": "Private work",
            "subject_id": classroom["subject"]["id"],
            "assignment_type": "homework",
            "max_points": 10,
        },
    )
    assignment = response.json()

    response = client.put(
        f"/api/assignments/my-assignments/{assignment['id']}",
        headers=other_headers,
        json={"name": "Hijacked"},
    )
    assert response.status_code == 403

    response = client.put(
        f"/api/assignments/student-assignments/{assignment['id']}",
        headers=owner_headers,
        json={"status": "submitted"},
    )
    assert response.status_code == 200, response.text
    response = client.put(
        f"/api/assignments/my-assignments/{assignment['id']}",
        headers=owner_headers,
        json={"name": "Too late"},
    )
    assert response.status_code == 409

    # The one-off backing template cannot be assigned to another student.
    other, _ = student_factory()
    response = client.post(
        "/api/assignments/assign",
        headers=admin_headers,
        json={"template_id": assignment["template_id"], "student_ids": [other["id"]]},
    )
    assert response.status_code == 400
    assert "private one-offs" in response.json()["detail"]


def test_time_entry_crud_updates_cached_total_and_locks_after_submission(
    client, classroom, student_factory, assign, admin_headers
):
    student, headers = student_factory()
    assignment = assign(classroom["template"]["id"], student["id"])

    response = client.post(
        f"/api/assignments/student-assignments/{assignment['id']}/time-entries",
        headers=headers,
        json={"work_date": "2026-03-02", "minutes": 75, "note": "First session"},
    )
    assert response.status_code == 200, response.text
    entry = response.json()

    detail = client.get(
        f"/api/assignments/student-assignments/{assignment['id']}", headers=headers
    ).json()
    assert detail["time_spent_minutes"] == 75
    assert detail["started_date"] == "2026-03-02"

    response = client.put(
        f"/api/assignments/time-entries/{entry['id']}",
        headers=headers,
        json={"minutes": 90},
    )
    assert response.status_code == 200, response.text
    detail = client.get(
        f"/api/assignments/student-assignments/{assignment['id']}", headers=headers
    ).json()
    assert detail["time_spent_minutes"] == 90

    client.put(
        f"/api/assignments/student-assignments/{assignment['id']}",
        headers=headers,
        json={"status": "submitted"},
    )
    response = client.delete(
        f"/api/assignments/time-entries/{entry['id']}", headers=headers
    )
    assert response.status_code == 409

    # Administrators retain correction access after submission.
    response = client.delete(
        f"/api/assignments/time-entries/{entry['id']}", headers=admin_headers
    )
    assert response.status_code == 200, response.text


def test_time_entry_rejects_future_dates(client, classroom, student_factory, assign):
    student, headers = student_factory()
    assignment = assign(classroom["template"]["id"], student["id"])
    response = client.post(
        f"/api/assignments/student-assignments/{assignment['id']}/time-entries",
        headers=headers,
        json={
            "work_date": date(date.today().year + 1, 1, 1).isoformat(),
            "minutes": 30,
        },
    )
    assert response.status_code == 422


def test_journal_edits_are_explicit_and_moderation_does_not_mark_them(
    client, student_factory, admin_headers
):
    student, headers = student_factory()
    response = client.post(
        "/api/journal/entries",
        headers=headers,
        json={"title": "Day one", "content": "Original"},
    )
    assert response.status_code == 200, response.text
    entry = response.json()
    assert entry["edited_at"] is None

    response = client.put(
        f"/api/journal/entries/{entry['id']}",
        headers=headers,
        json={"content": "Revised"},
    )
    assert response.status_code == 200, response.text
    edited = response.json()
    assert edited["edited_at"] is not None
    assert edited["edited_by"] == student["id"]
    edited_at = edited["edited_at"]

    response = client.put(
        f"/api/journal/entries/{entry['id']}",
        headers=headers,
        json={"content": "Revised"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["edited_at"] == edited_at

    response = client.post(
        f"/api/journal/entries/{entry['id']}/reactions",
        headers=admin_headers,
        json={"reactions": ["Great insight"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["edited_at"] == edited_at

    response = client.put(
        f"/api/journal/entries/{entry['id']}",
        headers=admin_headers,
        json={"content": "Admin correction"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["edited_by_name"] == "Ad Min"

    backup = client.get("/api/backup/export", headers=admin_headers).json()
    response = client.delete(
        f"/api/journal/entries/{entry['id']}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    response = client.post(
        "/api/backup/import",
        json={"backup_data": backup},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    restored = client.get("/api/journal/entries", headers=headers).json()
    restored_entry = next(item for item in restored if item["title"] == "Day one")
    assert restored_entry["edited_at"] is not None
    assert restored_entry["edited_by_name"] == "Ad Min"
