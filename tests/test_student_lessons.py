"""Student "my lessons" endpoint tests: roster scoping, field privacy, and
the today-forward default range.
"""

from datetime import date, timedelta

TODAY = date.today()


def _create_lesson(client, headers, **body):
    body.setdefault("title", "Fractions")
    body.setdefault("date", TODAY.isoformat())
    r = client.post("/api/lessons/", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["lesson"]


def _my_lessons(client, headers, **params):
    r = client.get("/api/lessons/my-lessons", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_roster_scoping(client, admin_headers, student_factory):
    rostered, rostered_headers = student_factory()
    outsider, outsider_headers = student_factory()

    lesson = _create_lesson(
        client, admin_headers, title="Roster check", student_ids=[rostered["id"]]
    )

    mine = _my_lessons(client, rostered_headers)
    assert [lesson_json["id"] for lesson_json in mine] == [lesson["id"]]
    assert _my_lessons(client, outsider_headers) == []


def test_student_payload_omits_admin_fields(client, admin_headers, student_factory):
    student, student_headers = student_factory()
    _create_lesson(
        client,
        admin_headers,
        title="Privacy check",
        notes="Teacher-private prep notes",
        student_ids=[student["id"]],
        materials=[{"label": "Fraction tiles", "is_gathered": False}],
        resources=[{"label": "Khan video", "url": "https://khanacademy.org"}],
    )

    [payload] = _my_lessons(client, student_headers)
    assert "notes" not in payload
    assert "created_by" not in payload
    assert "students" not in payload
    assert "materials" not in payload
    # Student-facing content is present.
    assert payload["title"] == "Privacy check"
    assert payload["resources"][0]["url"] == "https://khanacademy.org"


def test_default_range_is_today_forward(client, admin_headers, student_factory):
    student, student_headers = student_factory()
    yesterday = (TODAY - timedelta(days=1)).isoformat()
    tomorrow = (TODAY + timedelta(days=1)).isoformat()

    _create_lesson(
        client, admin_headers, title="Past", date=yesterday, student_ids=[student["id"]]
    )
    _create_lesson(client, admin_headers, title="Today", student_ids=[student["id"]])
    _create_lesson(
        client,
        admin_headers,
        title="Future",
        date=tomorrow,
        student_ids=[student["id"]],
    )

    assert [lesson["title"] for lesson in _my_lessons(client, student_headers)] == [
        "Today",
        "Future",
    ]

    # Explicit start_date reaches back; end_date bounds the range (inclusive).
    with_past = _my_lessons(client, student_headers, start_date=yesterday)
    assert [lesson["title"] for lesson in with_past] == ["Past", "Today", "Future"]
    bounded = _my_lessons(
        client, student_headers, start_date=yesterday, end_date=TODAY.isoformat()
    )
    assert [lesson["title"] for lesson in bounded] == ["Past", "Today"]


def test_admin_session_rejected(client, admin_headers):
    r = client.get("/api/lessons/my-lessons", headers=admin_headers)
    assert r.status_code == 403, r.text


def test_student_work_links_only_include_own_records(
    client, admin_headers, student_factory, classroom
):
    first, first_headers = student_factory()
    second, second_headers = student_factory()
    lesson = _create_lesson(
        client,
        admin_headers,
        student_ids=[first["id"], second["id"]],
        templates=[{"template_id": classroom["template"]["id"]}],
    )
    [first_lesson] = _my_lessons(client, first_headers)
    [second_lesson] = _my_lessons(client, second_headers)
    assert len(first_lesson["assignments"]) == len(second_lesson["assignments"]) == 1
    first_work = first_lesson["assignments"][0]
    second_work = second_lesson["assignments"][0]
    assert first_work["id"] != second_work["id"]
    assert first_work["student_id"] == first["id"]
    assert second_work["student_id"] == second["id"]
    assert first_work["lesson_id"] == lesson["id"]
    assert "teacher_feedback" not in first_work
    assert "points_earned" not in first_work
    forbidden = client.get(
        f"/api/assignments/student-assignments/{second_work['id']}",
        headers=first_headers,
    )
    assert forbidden.status_code == 403


def test_teacher_work_progress_is_day_scoped_and_student_inaccessible(
    client, admin_headers, student_factory, classroom
):
    student, student_headers = student_factory()
    today = _create_lesson(
        client,
        admin_headers,
        student_ids=[student["id"]],
        templates=[{"template_id": classroom["template"]["id"]}],
    )
    future = _create_lesson(
        client,
        admin_headers,
        date=(TODAY + timedelta(days=1)).isoformat(),
        student_ids=[student["id"]],
        templates=[{"template_id": classroom["template"]["id"]}],
    )
    response = client.get(
        "/api/lessons/assignment-progress",
        params={"date": TODAY.isoformat()},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    lesson_ids = [row["lesson_id"] for row in response.json()]
    assert today["id"] in lesson_ids
    assert future["id"] not in lesson_ids
    assert (
        client.get(
            "/api/lessons/assignment-progress",
            params={"date": TODAY.isoformat()},
            headers=student_headers,
        ).status_code
        == 403
    )
