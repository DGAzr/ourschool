"""Paper completion and help requests respect ownership and JSON recovery."""

from app.models.assignment import StudentAssignment, AssignmentStatus


def task(db_session, student_id, template_id):
    from datetime import date

    row = StudentAssignment(
        student_id=student_id, template_id=template_id, assigned_date=date.today()
    )
    db_session.add(row)
    db_session.commit()
    return row.id


def test_paper_completion_and_notes_are_owned_and_json_restorable(
    client, admin_headers, student_factory, classroom, db_session
):
    student, headers = student_factory()
    _, other_headers = student_factory()
    assignment_id = task(db_session, student["id"], classroom["template"]["id"])
    url = f"/api/assignments/student-assignments/{assignment_id}"
    payload = {
        "status": "submitted",
        "submission_method": "paper",
        "submission_notes": "My work is on the kitchen table.",
    }
    assert client.put(url, json=payload, headers=other_headers).status_code == 403
    submitted = client.put(url, json=payload, headers=headers)
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["submission_method"] == "paper"
    assert "attachments" not in submitted.json()
    backup = client.get("/api/backup/export", headers=admin_headers).json()
    archived = next(
        r
        for r in backup["student_assignments"]
        if r["student_email"] == student["email"]
    )
    assert archived["submission_method"] == "paper"
    assert archived["submission_notes"] == payload["submission_notes"]
    assert "work_attachments" not in archived
    db_session.delete(db_session.get(StudentAssignment, assignment_id))
    db_session.commit()
    restored = client.post(
        "/api/backup/import", json={"backup_data": backup}, headers=admin_headers
    )
    assert restored.status_code == 200 and restored.json()["success"], restored.text
    row = db_session.query(StudentAssignment).filter_by(student_id=student["id"]).one()
    assert row.submission_method == "paper"
    assert row.submission_notes == payload["submission_notes"]
    assert row.status == AssignmentStatus.SUBMITTED


def test_help_requests_are_owned_and_teacher_resolves(
    client, admin_headers, student_factory, classroom, db_session
):
    student, headers = student_factory()
    _, other_headers = student_factory()
    assignment_id = task(db_session, student["id"], classroom["template"]["id"])
    url = f"/api/assignments/student-assignments/{assignment_id}/help"
    assert (
        client.post(
            url, json={"note": "Private task"}, headers=other_headers
        ).status_code
        == 403
    )
    r = client.post(url, json={"note": "I do not understand step two"}, headers=headers)
    assert r.status_code == 200, r.text
    request = r.json()
    assert client.post(url, json={"note": "Again"}, headers=headers).status_code == 409
    assert (
        client.get("/api/assignments/help-requests", headers=headers).status_code == 403
    )
    inbox = client.get("/api/assignments/help-requests", headers=admin_headers)
    assert inbox.status_code == 200, inbox.text
    assert any(item["id"] == request["id"] for item in inbox.json()["items"])
    resolve = f'/api/assignments/help-requests/{request["id"]}/resolve'
    assert (
        client.post(resolve, json={"response": "Helped"}, headers=headers).status_code
        == 403
    )
    resolved = client.post(
        resolve,
        json={"response": "We worked through step two together."},
        headers=admin_headers,
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["resolved_at"]
    detail = client.get(
        f"/api/assignments/student-assignments/{assignment_id}", headers=headers
    ).json()
    assert (
        detail["help_requests"][0]["response"] == "We worked through step two together."
    )


def test_teacher_controls_simple_mode_but_student_controls_preferences(
    client, admin_headers, student_factory
):
    student, headers = student_factory()
    assert (
        client.put(
            "/api/users/me", json={"student_ui_mode": "simple"}, headers=headers
        ).status_code
        == 403
    )
    r = client.put(
        f'/api/users/{student["id"]}',
        json={"student_ui_mode": "simple"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["student_ui_mode"] == "simple"
    r = client.put(
        "/api/users/me",
        json={"show_points": False, "show_effort_signals": False},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["show_points"] is False
    assert (
        client.put(
            "/api/users/me", json={"show_points": None}, headers=headers
        ).status_code
        == 422
    )


def test_today_filters_and_recent_cursor(
    client, admin_headers, student_factory, classroom, db_session
):
    from datetime import date, datetime, timezone, timedelta

    student, headers = student_factory()
    rows = []
    for offset in [-3, 0, 2]:
        row = StudentAssignment(
            student_id=student["id"],
            template_id=classroom["template"]["id"],
            assigned_date=date.today(),
            due_date=date.today() + timedelta(days=offset),
            updated_at=datetime.now(timezone.utc) + timedelta(seconds=offset),
        )
        db_session.add(row)
        rows.append(row)
    db_session.commit()
    url = "/api/assignments/page"
    today = client.get(
        url,
        params={
            "student_view": "true",
            "tab": "todo",
            "due_from": date.today().isoformat(),
            "due_to": date.today().isoformat(),
        },
        headers=headers,
    )
    assert today.status_code == 200, today.text
    assert [r["id"] for r in today.json()["items"]] == [rows[1].id]
    first = client.get(
        url,
        params={"student_view": "true", "tab": "todo", "sort": "recent", "limit": 1},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["items"][0]["id"] == rows[2].id
    second = client.get(
        url,
        params={
            "student_view": "true",
            "tab": "todo",
            "sort": "recent",
            "limit": 1,
            "cursor": first.json()["next_cursor"],
        },
        headers=headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["items"][0]["id"] == rows[1].id
    assert (
        client.put(
            f"/api/assignments/student-assignments/{rows[1].id}",
            json={"submission_method": None},
            headers=headers,
        ).status_code
        == 422
    )
