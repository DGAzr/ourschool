"""Performance contracts: bounded projection, complete discovery, scoped counts."""

from datetime import date
from contextlib import contextmanager

import pytest
from sqlalchemy import event


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


def get_page(client, headers, **params):
    response = client.get("/api/assignments/page", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_library_complete_search_and_constant_stats(
    client, admin_headers, classroom, db_session, engine
):
    from app.models.assignment import AssignmentTemplate, StudentAssignment
    from app.models.user import User, UserRole

    subject_id = classroom["subject"]["id"]
    templates = [
        AssignmentTemplate(
            name=f"Paged {i:03}",
            subject_id=subject_id,
            description="a" * 5000,
            instructions="private instructions" * 500,
        )
        for i in range(151)
    ]
    db_session.add_all(templates)
    student = User(
        username=f"paged-{subject_id}",
        email=f"paged-{subject_id}@test.local",
        first_name="Paged",
        last_name="Student",
        role=UserRole.STUDENT,
        hashed_password="unused",
    )
    db_session.add(student)
    db_session.flush()
    db_session.add_all(
        [
            StudentAssignment(
                template_id=templates[0].id,
                student_id=student.id,
                status="graded",
                is_graded=True,
                points_earned=0,
                percentage_grade=0,
            ),
            StudentAssignment(
                template_id=templates[0].id, student_id=student.id, status="excused"
            ),
            StudentAssignment(
                template_id=templates[0].id, student_id=student.id, status="submitted"
            ),
        ]
    )
    db_session.commit()
    path = "/api/assignments/templates/page"
    params = dict(subject_id=subject_id, search="Paged", limit=50)
    with statements(engine) as sql:
        response = client.get(path, params=params, headers=admin_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(sql) < 10
    assert not any("paperless" in s.lower() for s in sql)
    assert body["total"] == 151
    assert body["items"][0]["average_grade"] == 0
    assert body["items"][0]["active_assigned"] == 1
    assert body["items"][0]["total_assigned"] == 3
    assert body["items"][1]["total_assigned"] == 0
    assert body["items"][1]["active_assigned"] == 0
    assert body["items"][1]["average_grade"] is None
    assert "instructions" not in body["items"][0]
    assert len(body["items"][0]["description"]) == 240
    ids = [t["id"] for t in body["items"]]
    while body["next_cursor"]:
        body = client.get(
            path,
            params={**params, "cursor": body["next_cursor"]},
            headers=admin_headers,
        ).json()
        ids.extend(t["id"] for t in body["items"])
    assert len(ids) == len(set(ids)) == 151
    found = client.get(
        path, params={**params, "search": "Paged 150"}, headers=admin_headers
    ).json()
    assert found["total"] == 1
    # Legacy array shape still supported, now with batched statistics.
    with statements(engine) as sql:
        old = client.get(
            "/api/assignments/templates",
            params={"subject_id": subject_id, "limit": 1000},
            headers=admin_headers,
        )
    assert old.status_code == 200
    assert len(old.json()) == 152
    assert len(sql) < 12


def test_assignment_pages_counts_ties_nulls_and_authorization(
    client, admin_headers, classroom, student_factory, db_session, engine
):
    from app.models.assignment import StudentAssignment

    student, headers = student_factory()
    other, _ = student_factory()
    rows = [
        StudentAssignment(
            template_id=classroom["template"]["id"],
            student_id=student["id"],
            due_date=date(2026, 2, 1) if i < 105 else None,
            assigned_date=date(2026, 1, 20),
            status="graded" if i % 2 else "not_started",
            is_graded=bool(i % 2),
            teacher_feedback="secret long feedback" * 500,
            custom_instructions="long instructions" * 500,
        )
        for i in range(123)
    ]
    db_session.add_all(rows)
    db_session.add(
        StudentAssignment(
            template_id=classroom["template"]["id"], student_id=other["id"]
        )
    )
    db_session.commit()
    with statements(engine) as sql:
        body = get_page(client, headers, limit=20)
    assert len(sql) < 10
    assert not any("paperless" in s.lower() for s in sql)
    assert body["total"] == 123
    assert body["counts"]["graded"] == 61
    assert body["counts"]["todo"] == 62
    assert body["items"][0]["teacher_feedback"] == "secret long feedback" * 500
    assert "custom_instructions" not in body["items"][0]
    ids = [a["id"] for a in body["items"]]
    while body["next_cursor"]:
        body = get_page(client, headers, limit=20, cursor=body["next_cursor"])
        ids.extend(a["id"] for a in body["items"])
    assert len(ids) == len(set(ids)) == 123
    detail = client.get(
        f"/api/assignments/student-assignments/{ids[0]}", headers=headers
    ).json()
    assert len(detail["teacher_feedback"]) > 5000
    forbidden = client.get(
        "/api/assignments/page", params={"student_id": other["id"]}, headers=headers
    )
    assert forbidden.status_code == 403
    scoped = get_page(client, admin_headers, student_id=other["id"])
    assert scoped["total"] == 1
    assert "teacher_feedback" not in scoped["items"][0]
    student_preview = get_page(
        client, admin_headers, student_id=student["id"], student_view=True, tab="done"
    )
    assert student_preview["items"][0]["teacher_feedback"] == "secret long feedback" * 500
    assert client.get("/api/assignments/page").status_code == 401


def test_explicit_term_bases_and_student_open_history(
    client, admin_headers, classroom, student_factory, db_session
):
    from app.models.assignment import StudentAssignment

    student, headers = student_factory()
    template_id = classroom["template"]["id"]
    term_id = classroom["term"]["id"]
    db_session.add_all(
        [
            StudentAssignment(
                template_id=template_id,
                student_id=student["id"],
                status="graded",
                is_graded=True,
                assigned_date=date(2025, 12, 1),
                due_date=date(2026, 2, 1),
                extended_due_date=date(2026, 9, 1),
            ),
            StudentAssignment(
                template_id=template_id,
                student_id=student["id"],
                status="not_started",
                assigned_date=date(2025, 12, 1),
                due_date=date(2025, 12, 2),
            ),
        ]
    )
    db_session.commit()
    params = dict(student_id=student["id"], term_id=term_id)
    assert (
        get_page(client, admin_headers, **params, term_basis="assigned")["total"] == 0
    )
    assert (
        get_page(client, admin_headers, **params, term_basis="original_due")["total"]
        == 1
    )
    assert (
        get_page(client, admin_headers, **params, term_basis="effective")["total"] == 0
    )
    student_page = get_page(
        client, headers, term_id=term_id, term_basis="original_due", tab="todo"
    )
    assert student_page["total"] == 1
    assert student_page["counts"]["done"] == 1


@pytest.mark.parametrize("cursor", ["bad", "W10=", "WyJub3QtYS1kYXRlIiwxXQ=="])
def test_bad_cursors_rejected(client, admin_headers, cursor):
    response = client.get(
        "/api/assignments/page", params={"cursor": cursor}, headers=admin_headers
    )
    assert response.status_code == 422


def test_report_page_totals_export_and_zero_grade(
    client, admin_headers, classroom, student_factory, db_session, engine
):
    from app.models.assignment import StudentAssignment

    student, _ = student_factory()
    db_session.add_all(
        [
            StudentAssignment(
                template_id=classroom["template"]["id"],
                student_id=student["id"],
                status="graded",
                is_graded=True,
                points_earned=0,
                percentage_grade=0,
                graded_date=date(2026, 2, 1),
                assigned_date=date(2026, 2, 1),
                teacher_feedback="=FORMULA()",
            )
            for _ in range(75)
        ]
    )
    db_session.commit()
    with statements(engine) as sql:
        response = client.get(
            "/api/reports/admin/assignments/page",
            params={"student_id": student["id"], "limit": 10},
            headers=admin_headers,
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 75 and len(body["items"]) == 10
    assert body["summary"]["average_grade"] == 0
    assert body["by_subject"][0]["done"] == 75
    assert len(body["recently_graded"]) == 10
    assert len(sql) < 15
    assert not any("paperless" in s.lower() for s in sql)
    exported = client.get(
        "/api/reports/admin/assignments/export",
        params={"student_id": student["id"]},
        headers=admin_headers,
    )
    assert exported.status_code == 200
    assert len(exported.text.splitlines()) == 76
    assert "'=FORMULA()" in exported.text


def test_bulk_grade_recalculates_bucket_once(
    client, admin_headers, classroom, student_factory, assign, monkeypatch
):
    from app.models.assignment import StudentAssignment

    student, _ = student_factory()
    rows = [
        assign(classroom["template"]["id"], student["id"], due_date="2026-02-01")
        for _ in range(3)
    ]
    original = StudentAssignment.update_term_grade
    recalculated = []

    def tracked(self, session):
        recalculated.append(self.id)
        return original(self, session)

    monkeypatch.setattr(StudentAssignment, "update_term_grade", tracked)
    response = client.post(
        "/api/assignments/bulk-grade",
        headers=admin_headers,
        json=[
            *[dict(assignment_id=a["id"], points_earned=80) for a in rows],
            dict(assignment_id=999999999, points_earned=80),
        ],
    )
    assert response.status_code == 200, response.text
    assert [item["success"] for item in response.json()] == [True, True, True, False]
    assert len(recalculated) == 1


def test_request_metrics_are_bounded_and_content_free(client, admin_headers, engine):
    from app.utils.request_performance import instrument_engine

    # The test dependency replaces get_db with its own engine. Production
    # instruments the engine during get_engine().
    instrument_engine(engine)
    get_page(client, admin_headers, limit=1)
    response = client.get("/api/performance/requests", headers=admin_headers)
    assert response.status_code == 200, response.text
    metric = response.json()["GET /api/assignments/page"]
    assert metric["sample_count"] <= 256
    assert metric["rows_returned"]["max"] <= 100
    assert metric["response_bytes"]["max"] > 0
    assert metric["sql_count"]["max"] >= 2
    assert "sql_ms" in metric and "connection_acquire_ms" in metric


def test_bulk_grade_bucket_failure_preserves_other_students(
    client,
    admin_headers,
    classroom,
    student_factory,
    assign,
    monkeypatch,
):
    from app.models.assignment import StudentAssignment

    first, _ = student_factory()
    second, _ = student_factory()
    rows = [
        assign(classroom["template"]["id"], student["id"], due_date="2026-02-01")
        for student in (first, second)
    ]
    original = StudentAssignment.update_term_grade

    def fail_one_bucket(self, session):
        if self.student_id == first["id"]:
            raise ValueError("Synthetic aggregate failure")
        return original(self, session)

    monkeypatch.setattr(StudentAssignment, "update_term_grade", fail_one_bucket)
    response = client.post(
        "/api/assignments/bulk-grade",
        headers=admin_headers,
        json=[dict(assignment_id=row["id"], points_earned=90) for row in rows],
    )
    assert response.status_code == 200, response.text
    assert [r["success"] for r in response.json()] == [False, True]
    first_row = client.get(
        f"/api/assignments/student-assignments/{rows[0]['id']}", headers=admin_headers
    ).json()
    second_row = client.get(
        f"/api/assignments/student-assignments/{rows[1]['id']}", headers=admin_headers
    ).json()
    assert first_row["is_graded"] is False and first_row["points_earned"] is None
    assert second_row["is_graded"] is True and second_row["points_earned"] == 90


def test_template_archive_one_off_and_owner_scope(
    client, admin_headers, classroom, student_factory, db_session
):
    from app.models.assignment import AssignmentTemplate

    student, headers = student_factory()
    subject_id = classroom["subject"]["id"]
    db_session.add_all(
        [
            AssignmentTemplate(
                name="Scoped active", subject_id=subject_id, created_by=student["id"]
            ),
            AssignmentTemplate(
                name="Scoped archived", subject_id=subject_id, is_archived=True
            ),
            AssignmentTemplate(
                name="Scoped private", subject_id=subject_id, is_library=False
            ),
        ]
    )
    db_session.commit()
    path = "/api/assignments/templates/page"
    filters = dict(subject_id=subject_id, search="Scoped", with_stats=False)
    active = client.get(path, params=filters, headers=admin_headers).json()
    assert active["total"] == 1
    assert "total_assigned" not in active["items"][0]
    archived = client.get(
        path, params={**filters, "archived": True}, headers=admin_headers
    ).json()
    assert [r["name"] for r in archived["items"]] == ["Scoped archived"]
    all_active = client.get(
        path, params={**filters, "include_one_offs": True}, headers=admin_headers
    ).json()
    assert all_active["total"] == 2
    own = client.get(
        path, params={**filters, "include_one_offs": True}, headers=headers
    ).json()
    assert [r["name"] for r in own["items"]] == ["Scoped active"]
    assert (
        client.get("/api/reports/admin/assignments/page", headers=headers).status_code
        == 403
    )
    assert (
        client.get("/api/reports/admin/assignments/export", headers=headers).status_code
        == 403
    )


def test_aggregate_progress_preserves_denominator_and_empty_students(
    client, admin_headers, classroom, student_factory, db_session, engine
):
    from app.models.assignment import StudentAssignment

    student, headers = student_factory()
    empty, _ = student_factory()
    db_session.add_all(
        [
            StudentAssignment(
                template_id=classroom["template"]["id"],
                student_id=student["id"],
                status=status,
                is_graded=points is not None,
                points_earned=points,
            )
            for status, points in [
                ("graded", 0),
                ("graded", 80),
                ("submitted", None),
                ("excused", None),
            ]
        ]
    )
    db_session.commit()
    with statements(engine) as sql:
        response = client.get(
            f"/api/assignments/students/{student['id']}/progress", headers=headers
        )
    assert response.status_code == 200, response.text
    assert response.json()["total_assignments"] == 4
    assert response.json()["completed_assignments"] == 2
    # Progress intentionally divides by all assigned work, including excused.
    assert response.json()["average_grade"] == 20
    assert len(sql) < 8
    assert not any("paperless" in statement.lower() for statement in sql)
    with statements(engine) as sql:
        dashboard = client.get(
            "/api/assignments/dashboard/overview", headers=admin_headers
        )
    assert dashboard.status_code == 200, dashboard.text
    by_id = {row["id"]: row for row in dashboard.json()["students"]}
    assert by_id[student["id"]]["total_assignments"] == 4
    assert by_id[student["id"]]["completed_assignments"] == 2
    assert by_id[student["id"]]["pending_grades"] == 1
    assert by_id[empty["id"]]["total_assignments"] == 0
    assert len(sql) < 8
    assert not any("paperless" in statement.lower() for statement in sql)


def test_awaiting_submission_count_includes_legacy_overdue_work(
    client, admin_headers, classroom, student_factory, assign, db_session
):
    from app.models.assignment import StudentAssignment
    from app.enums import AssignmentStatus

    student, _ = student_factory()
    assignment = assign(
        classroom["template"]["id"], student["id"], due_date="2026-01-01"
    )
    row = db_session.get(StudentAssignment, assignment["id"])
    row.status = AssignmentStatus.OVERDUE
    db_session.commit()
    page = get_page(client, admin_headers, student_id=student["id"], tab="awaiting")
    assert page["counts"]["awaiting_submission"] == page["counts"]["awaiting"] == 1
    assert page["total"] == 1
