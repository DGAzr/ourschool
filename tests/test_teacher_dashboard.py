"""Teacher operational views share queue scopes and stay bounded as history grows."""

from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import event

from app.crud import teacher_dashboard as reads
from app.models.assignment import StudentAssignment, AssignmentHelpRequest
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry
from app.models.shop import ShopRedemption
from app.models.user import User

TODAY = date(2026, 10, 9)  # Friday: preparation must find Monday, not Saturday.


def read(client, headers, section, **params):
    response = client.get(
        f"/api/dashboard/teacher/{section}", headers=headers, params=params
    )
    assert response.status_code == 200, response.text
    return response.json()


@contextmanager
def statements(engine):
    sql = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        sql.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        yield sql
    finally:
        event.remove(engine, "before_cursor_execute", capture)


@pytest.mark.parametrize(
    "section", ["schedule", "preparation", "students", "inbox", "activity", "roster"]
)
def test_dashboard_requires_teacher(client, student_factory, section):
    _, headers = student_factory()
    response = client.get(
        f"/api/dashboard/teacher/{section}",
        params={"today": str(TODAY)},
        headers=headers,
    )
    assert response.status_code == 403
    assert (
        client.get(
            f"/api/dashboard/teacher/{section}", params={"today": str(TODAY)}
        ).status_code
        == 401
    )


def test_review_counts_effective_deadlines_and_exact_lists(
    client, admin_headers, student_factory, classroom, db_session
):
    student, _ = student_factory()
    sid = student["id"]
    template = classroom["template"]["id"]
    specs = [
        ("submitted", False, TODAY, None),
        ("not_started", False, TODAY, None),
        ("in_progress", False, TODAY - timedelta(days=3), None),
        ("overdue", False, TODAY - timedelta(days=8), None),
        ("not_started", False, None, None),
        ("not_started", False, TODAY - timedelta(days=4), TODAY + timedelta(days=10)),
        ("graded", False, TODAY, None),
        ("submitted", True, TODAY, None),
        ("excused", False, TODAY, None),
    ]
    db_session.add_all(
        [
            StudentAssignment(
                template_id=template,
                student_id=sid,
                status=status,
                is_graded=graded,
                due_date=due,
                extended_due_date=extended,
            )
            for status, graded, due, extended in specs
        ]
    )
    db_session.commit()
    overview = read(client, admin_headers, "students", today=TODAY, student_id=sid)[
        "items"
    ][0]
    assert {
        key: overview["work"][key] for key in ("review", "needs", "awaiting", "overdue")
    } == dict(review=5, needs=1, awaiting=4, overdue=2)
    for tab in ("review", "needs", "awaiting", "overdue"):
        response = client.get(
            "/api/assignments/page",
            headers=admin_headers,
            params=dict(
                tab=tab,
                student_id=sid,
                active_students=True,
                effective_due=True,
                today=TODAY,
                due_to=TODAY,
                include_undated=True,
            ),
        )
        assert response.status_code == 200, response.text
        page = response.json()
        assert page["total"] == overview["work"][tab] == len(page["items"])
        assert page["counts"]["review"] == 5
        assert all(
            not row["is_graded"] and row["status"] not in ("graded", "excused")
            for row in page["items"]
        )
    assert (
        read(
            client,
            admin_headers,
            "students",
            today=TODAY,
            student_id=sid,
            all_work=True,
        )["items"][0]["work"]["review"]
        == 6
    )
    db_session.query(User).filter(User.id == sid).update({"is_active": False})
    db_session.commit()
    assert (
        read(client, admin_headers, "students", today=TODAY, student_id=sid)["total"]
        == 0
    )


@pytest.mark.parametrize("status", ["present", "absent", "late", "excused"])
def test_attendance_any_record_and_next_scheduled_day(
    client, admin_headers, student_factory, db_session, status
):
    student, _ = student_factory()
    sid = student["id"]
    db_session.add(AttendanceRecord(student_id=sid, date=TODAY, status=status))
    db_session.commit()

    def lesson(day, title, status="planned"):
        response = client.post(
            "/api/lessons/",
            headers=admin_headers,
            json=dict(
                title=title,
                date=str(day),
                status=status,
                student_ids=[sid],
                materials=[dict(label="Tiles", is_gathered=False)],
            ),
        )
        assert response.status_code == 200, response.text
        return response.json()["lesson"]

    item = lesson(TODAY, "Today")
    lesson(TODAY + timedelta(days=1), "Already taught", "taught")
    next_item = lesson(TODAY + timedelta(days=3), "Monday")
    data = read(client, admin_headers, "schedule", today=TODAY, student_id=sid)
    assert data["attendance"] == dict(
        total=1, recorded=1, records=[dict(student_id=sid, status=status)]
    )
    assert data["items"][0]["id"] == item["id"] and data["materials_remaining"] == 1
    future = read(client, admin_headers, "preparation", today=TODAY, student_id=sid)
    assert future["date"] == str(TODAY + timedelta(days=3))
    assert future["items"][0]["id"] == next_item["id"]
    week = read(
        client, admin_headers, "schedule", today=TODAY, scope="week", student_id=sid
    )
    assert week["start_date"] == "2026-10-05" and week["end_date"] == "2026-10-11"
    assert week["total"] == 2 and week["taught"] == 1


def test_inbox_oldest_first_pagination_parity_and_actions(
    client, admin_headers, student_factory, classroom, db_session
):
    student, _ = student_factory()
    sid = student["id"]
    old = datetime(2025, 1, 1, tzinfo=timezone.utc)
    journals = [
        JournalEntry(
            student_id=sid,
            author_id=sid,
            title=f"Reflection {i}",
            content="**My day**",
            created_at=old + timedelta(days=i),
        )
        for i in range(6)
    ]
    rewards = [
        ShopRedemption(
            student_id=sid,
            item_name=status,
            cost_points=5,
            fulfillment_type="request",
            status=status,
        )
        for status in ("pending", "ready", "fulfilled")
    ]
    assignment = StudentAssignment(
        student_id=sid, template_id=classroom["template"]["id"]
    )
    db_session.add_all([*journals, *rewards, assignment])
    db_session.flush()
    help_request = AssignmentHelpRequest(
        assignment_id=assignment.id, note="Explain fractions"
    )
    db_session.add(help_request)
    db_session.commit()
    data = read(client, admin_headers, "inbox", student_id=sid)["groups"]
    assert data["journals"]["total"] == 6 and len(data["journals"]["items"]) == 3
    assert [r["id"] for r in data["journals"]["items"]] == [r.id for r in journals[:3]]
    page = read(
        client,
        admin_headers,
        "inbox",
        student_id=sid,
        category="journals",
        offset=3,
        limit=3,
    )["groups"]["journals"]
    assert [r["id"] for r in page["items"]] == [
        r.id for r in journals[3:]
    ] and not page["has_more"]
    full = client.get(
        "/api/journal/entries/page",
        headers=admin_headers,
        params=dict(student_id=sid, review="needs", active_students=True),
    ).json()
    assert full["total"] == 6 and [r["id"] for r in full["items"]] == [
        r.id for r in journals
    ]
    if "approvals" in data:
        for category, status in (("approvals", "pending"), ("pickups", "ready")):
            full = client.get(
                "/api/shop/redemptions",
                headers=admin_headers,
                params=dict(student_id=sid, status=status, active_students=True),
            )
            assert full.status_code == 200, full.text
            assert len(full.json()) == data[category]["total"] == 1
    assert data["help"]["total"] == 1
    response = client.post(
        f"/api/journal/entries/{journals[0].id}/mark-read", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    response = client.post(
        f"/api/assignments/help-requests/{help_request.id}/resolve",
        headers=admin_headers,
        json={"response": "We reviewed it together"},
    )
    assert response.status_code == 200, response.text
    updated = read(client, admin_headers, "inbox", student_id=sid)["groups"]
    assert updated["journals"]["total"] == 5 and updated["help"]["total"] == 0


def test_history_does_not_expand_dashboard_queries(
    client, admin_headers, student_factory, db_session, engine
):
    student, _ = student_factory()
    sid = student["id"]

    def measured():
        with statements(engine) as sql:
            body = read(client, admin_headers, "inbox", student_id=sid)
        return body, len(sql)

    baseline, count = measured()
    db_session.add_all(
        [
            JournalEntry(
                student_id=sid,
                author_id=sid,
                title=f"Old {i}",
                content="long history " * 2000,
                needs_response=False,
            )
            for i in range(300)
        ]
    )
    db_session.commit()
    body, grown = measured()
    assert grown == count and grown < 15
    assert body == baseline
    assert reads.scope_dates(date(2026, 10, 11), "week") == (
        date(2026, 10, 5),
        date(2026, 10, 11),
    )


def test_journal_dates_and_inactive_students(
    client, admin_headers, student_factory, db_session
):
    student, _ = student_factory()
    sid = student["id"]
    entry = JournalEntry(
        student_id=sid,
        author_id=sid,
        title="Late evening",
        content="Reflection",
        entry_date=datetime(2026, 10, 6, 2, tzinfo=timezone.utc),
    )
    db_session.add(entry)
    db_session.commit()
    params = dict(
        student_id=sid,
        review="needs",
        active_students=True,
        timezone="America/New_York",
        date_from="2026-10-05",
        date_to="2026-10-05",
    )
    response = client.get(
        "/api/journal/entries/page", headers=admin_headers, params=params
    )
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert (
        client.get(
            "/api/journal/entries/page",
            headers=admin_headers,
            params={**params, "date_from": "2026-10-06", "date_to": "2026-10-06"},
        ).json()["total"]
        == 0
    )
    db_session.query(User).filter(User.id == sid).update({"is_active": False})
    db_session.commit()
    assert (
        read(client, admin_headers, "inbox", student_id=sid)["groups"]["journals"][
            "total"
        ]
        == 0
    )
    assert (
        client.get(
            "/api/journal/entries/page", headers=admin_headers, params=params
        ).json()["total"]
        == 0
    )


def test_disabled_points_omit_reward_queues(client, admin_headers, db_session):
    from app.crud import points

    points.update_system_setting(db_session, "points_system_enabled", "false")
    try:
        data = read(client, admin_headers, "inbox")["groups"]
        assert "approvals" not in data and "pickups" not in data
        assert "journals" in data and "help" in data
    finally:
        points.update_system_setting(db_session, "points_system_enabled", "true")


def test_paging_recovers_when_last_request_is_reviewed(
    client, admin_headers, student_factory, db_session
):
    student, _ = student_factory()
    sid = student["id"]
    rows = [
        JournalEntry(student_id=sid, author_id=sid, title=f"Page {i}", content="Review")
        for i in range(4)
    ]
    db_session.add_all(rows)
    db_session.commit()
    page = read(
        client,
        admin_headers,
        "inbox",
        student_id=sid,
        category="journals",
        offset=3,
        limit=3,
    )
    assert page["offset"] == 3 and len(page["groups"]["journals"]["items"]) == 1
    rows[-1].needs_response = False
    db_session.commit()
    page = read(
        client,
        admin_headers,
        "inbox",
        student_id=sid,
        category="journals",
        offset=3,
        limit=3,
    )
    assert page["offset"] == 0 and len(page["groups"]["journals"]["items"]) == 3
