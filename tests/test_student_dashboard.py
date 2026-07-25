"""Student dashboard reporting tests."""


def _set_status(client, headers, assignment_id, status):
    response = client.put(
        f"/api/assignments/student-assignments/{assignment_id}",
        json={"status": status},
        headers=headers,
    )
    assert response.status_code == 200, response.text


def _grade(client, headers, assignment_id, points):
    response = client.post(
        f"/api/assignments/student-assignments/{assignment_id}/grade",
        json={"points_earned": points},
        headers=headers,
    )
    assert response.status_code == 200, response.text


def test_student_dashboard_stats_only_include_active_term_assignments(
    client, admin_headers, classroom, student_factory, assign
):
    student, student_headers = student_factory()

    response = client.post(
        "/api/terms/",
        json={
            "name": "Prior term",
            "start_date": "2025-01-06",
            "end_date": "2025-06-06",
            "academic_year": "2024-2025",
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    current_graded = assign(
        classroom["template"]["id"], student["id"], due_date="2026-03-01"
    )
    current_in_progress = assign(
        classroom["template"]["id"], student["id"], due_date="2026-04-01"
    )
    current_submitted = assign(
        classroom["template"]["id"], student["id"], due_date="2026-05-01"
    )

    historical_graded = assign(
        classroom["template"]["id"],
        student["id"],
        assigned_date="2025-02-01",
        due_date="2025-03-01",
    )
    historical_in_progress = assign(
        classroom["template"]["id"],
        student["id"],
        assigned_date="2025-02-01",
        due_date="2025-04-01",
    )
    historical_submitted = assign(
        classroom["template"]["id"],
        student["id"],
        assigned_date="2025-02-01",
        due_date="2025-05-01",
    )

    _grade(client, admin_headers, current_graded["id"], 80)
    _set_status(
        client, student_headers, current_in_progress["id"], "in_progress"
    )
    _set_status(client, student_headers, current_submitted["id"], "submitted")

    _grade(client, admin_headers, historical_graded["id"], 100)
    _set_status(
        client, student_headers, historical_in_progress["id"], "in_progress"
    )
    _set_status(client, student_headers, historical_submitted["id"], "submitted")

    response = client.get("/api/reports/student/overview", headers=student_headers)
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["total_assignments"] == 3
    assert report["completed_assignments"] == 1
    assert report["in_progress_assignments"] == 1
    assert report["pending_grades"] == 1
    assert report["current_term_grade"] == 80
