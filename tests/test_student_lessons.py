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
    _create_lesson(
        client, admin_headers, title="Today", student_ids=[student["id"]]
    )
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
