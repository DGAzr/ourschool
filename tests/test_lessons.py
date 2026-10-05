"""End-to-end lesson planning tests: CRUD, date-range, and assignment sync.

Sync is the subtle part: creating/rescheduling/deleting a lesson with a linked
template must create, move, or clean up StudentAssignments — while never
destroying graded/submitted work (it gets orphaned, ``lesson_id = None``,
instead).
"""

from datetime import date, datetime, timezone

import pytest

from app.enums import AssignmentStatus
from app.models.assignment import AssignmentTimeEntry, StudentAssignment


def _grade(client, headers, assignment_id, points, **extra):
    return client.post(
        f"/api/assignments/student-assignments/{assignment_id}/grade",
        json={"points_earned": points, **extra},
        headers=headers,
    )


def _create_lesson(client, headers, **body):
    body.setdefault("title", "Fractions")
    body.setdefault("date", "2026-02-10")
    return client.post("/api/lessons/", json=body, headers=headers)


def _link(template_id, **overrides):
    """A LessonTemplateLinkInput dict for the ``templates`` payload list."""
    return {"template_id": template_id, **overrides}


def _linked_sas(db_session, lesson_id):
    return (
        db_session.query(StudentAssignment)
        .filter(StudentAssignment.lesson_id == lesson_id)
        .all()
    )


def _sa_by_id(db_session, sa_id):
    """Fetch an SA fresh (None if deleted by the API in another session)."""
    db_session.expunge_all()
    return (
        db_session.query(StudentAssignment)
        .filter(StudentAssignment.id == sa_id)
        .first()
    )


# --- 1. CRUD round-trip -------------------------------------------------------
def test_crud_round_trip_with_nested_lists(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        title="Intro to Fractions",
        subject_id=classroom["subject"]["id"],
        objective="Understand halves and quarters",
        duration_minutes=45,
        student_ids=[student["id"]],
        materials=[
            {"label": "Fraction tiles", "is_gathered": False},
            {"label": "Worksheet", "is_gathered": True},
        ],
        resources=[{"label": "Khan video", "url": "https://khanacademy.org"}],
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    assert lesson["title"] == "Intro to Fractions"
    assert [m["label"] for m in lesson["materials"]] == ["Fraction tiles", "Worksheet"]
    assert [m["position"] for m in lesson["materials"]] == [0, 1]
    assert lesson["resources"][0]["url"] == "https://khanacademy.org"
    assert [s["id"] for s in lesson["students"]] == [student["id"]]

    lesson_id = lesson["id"]

    # GET
    r = client.get(f"/api/lessons/{lesson_id}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["subject"]["id"] == classroom["subject"]["id"]

    # PUT full-replace of nested lists (reorder + drop one material)
    r = client.put(
        f"/api/lessons/{lesson_id}",
        json={
            "title": "Fractions Deep Dive",
            "materials": [{"label": "Only this one", "is_gathered": False}],
            "status": "ready",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    updated = r.json()["lesson"]
    assert updated["title"] == "Fractions Deep Dive"
    assert updated["status"] == "ready"
    assert [m["label"] for m in updated["materials"]] == ["Only this one"]

    # DELETE
    r = client.delete(f"/api/lessons/{lesson_id}", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert (
        client.get(f"/api/lessons/{lesson_id}", headers=admin_headers).status_code
        == 404
    )


# --- 2. Date-range filter -----------------------------------------------------
def test_date_range_filter_inclusive_and_weekend_agnostic(client, admin_headers):
    # 2026-02-14 is a Saturday.
    for d in ("2026-02-09", "2026-02-14", "2026-02-20"):
        assert _create_lesson(client, admin_headers, date=d).status_code == 200

    r = client.get(
        "/api/lessons/",
        params={"start_date": "2026-02-09", "end_date": "2026-02-14"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    dates = {lesson["date"] for lesson in r.json()}
    # Boundaries inclusive; the Saturday is returned (API is skip_weekends-agnostic).
    assert "2026-02-09" in dates
    assert "2026-02-14" in dates
    assert "2026-02-20" not in dates


# --- 3. Create with template + students → SAs, no active term needed ----------
def test_create_with_template_creates_assignments(
    client, admin_headers, classroom, student_factory, db_session
):
    s1, _ = student_factory()
    s2, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-03-02",
        subject_id=classroom["subject"]["id"],
        templates=[_link(classroom["template"]["id"])],
        student_ids=[s1["id"], s2["id"]],
    )
    assert r.status_code == 200, r.text
    lesson_id = r.json()["lesson"]["id"]

    sas = _linked_sas(db_session, lesson_id)
    assert len(sas) == 2
    for sa in sas:
        assert sa.due_date == date(2026, 3, 2)
        assert sa.template_id == classroom["template"]["id"]
        assert sa.lesson_id == lesson_id

    r = client.get(
        f"/api/assignments/templates/{classroom['template']['id']}/assignments",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson_assignments = [
        assignment for assignment in r.json() if assignment["lesson_id"] == lesson_id
    ]
    assert {assignment["id"] for assignment in lesson_assignments} == {
        sa.id for sa in sas
    }


def test_create_with_template_works_without_active_term(
    client, admin_headers, classroom, student_factory, db_session
):
    # Deactivate the active term to prove lesson-created SAs don't gate on one.
    from app.models.term import Term

    for term in db_session.query(Term).all():
        term.is_active = False
    db_session.commit()

    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        templates=[_link(classroom["template"]["id"])],
        student_ids=[student["id"]],
    )
    assert r.status_code == 200, r.text
    assert len(_linked_sas(db_session, r.json()["lesson"]["id"])) == 1


# --- 4. Reschedule ------------------------------------------------------------
def test_reschedule_moves_ungraded_but_not_graded(
    client, admin_headers, classroom, student_factory, db_session
):
    s1, _ = student_factory()
    s2, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-03-02",
        templates=[_link(classroom["template"]["id"])],
        student_ids=[s1["id"], s2["id"]],
    )
    lesson_id = r.json()["lesson"]["id"]
    sas = _linked_sas(db_session, lesson_id)
    graded_sa = next(sa for sa in sas if sa.student_id == s1["id"])
    ungraded_sa = next(sa for sa in sas if sa.student_id == s2["id"])

    assert _grade(client, admin_headers, graded_sa.id, 90).status_code == 200

    r = client.put(
        f"/api/lessons/{lesson_id}", json={"date": "2026-03-09"}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert any("graded/submitted work" in w for w in r.json()["warnings"])

    db_session.expunge_all()
    assert db_session.get(StudentAssignment, ungraded_sa.id).due_date == date(
        2026, 3, 9
    )
    # Graded SA's due date stays put (moving it would shift term buckets).
    assert db_session.get(StudentAssignment, graded_sa.id).due_date == date(2026, 3, 2)


# --- 5. Student deselect ------------------------------------------------------
def test_deselect_deletes_ungraded_orphans_graded(
    client, admin_headers, classroom, student_factory, db_session
):
    s1, _ = student_factory()
    s2, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        templates=[_link(classroom["template"]["id"])],
        student_ids=[s1["id"], s2["id"]],
    )
    lesson_id = r.json()["lesson"]["id"]
    sas = _linked_sas(db_session, lesson_id)
    graded_sa = next(sa for sa in sas if sa.student_id == s1["id"])
    ungraded_sa = next(sa for sa in sas if sa.student_id == s2["id"])
    assert _grade(client, admin_headers, graded_sa.id, 88).status_code == 200

    # Deselect both students.
    r = client.put(
        f"/api/lessons/{lesson_id}", json={"student_ids": []}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert any("Kept student work" in w for w in r.json()["warnings"])

    # Ungraded SA is gone; graded one survives but is orphaned.
    assert _sa_by_id(db_session, ungraded_sa.id) is None
    survivor = _sa_by_id(db_session, graded_sa.id)
    assert survivor is not None
    assert survivor.lesson_id is None
    assert survivor.is_graded is True


# --- 6. Detach / change template ----------------------------------------------
def test_detach_template_removes_assignments(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        templates=[_link(classroom["template"]["id"])],
        student_ids=[student["id"]],
    )
    lesson_id = r.json()["lesson"]["id"]
    assert len(_linked_sas(db_session, lesson_id)) == 1

    r = client.put(
        f"/api/lessons/{lesson_id}", json={"templates": []}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    db_session.expunge_all()
    assert len(_linked_sas(db_session, lesson_id)) == 0


def test_change_template_swaps_assignments(
    client, admin_headers, classroom, student_factory, db_session
):
    # A second template on the same subject.
    r = client.post(
        "/api/assignments/templates",
        json={
            "name": "Second Worksheet",
            "subject_id": classroom["subject"]["id"],
            "assignment_type": "homework",
            "max_points": 100,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    template2 = r.json()

    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        templates=[_link(classroom["template"]["id"])],
        student_ids=[student["id"]],
    )
    lesson_id = r.json()["lesson"]["id"]
    original_sa = _linked_sas(db_session, lesson_id)[0]

    r = client.put(
        f"/api/lessons/{lesson_id}",
        json={"templates": [_link(template2["id"])]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    db_session.expunge_all()
    sas = _linked_sas(db_session, lesson_id)
    assert len(sas) == 1
    assert sas[0].template_id == template2["id"]
    # Old (ungraded) SA was removed outright.
    assert _sa_by_id(db_session, original_sa.id) is None


# --- 6b. Multiple templates on one lesson -------------------------------------
def test_multiple_templates_create_one_sa_per_link_per_student(
    client, admin_headers, classroom, student_factory, db_session
):
    # A second template on the same subject.
    r = client.post(
        "/api/assignments/templates",
        json={
            "name": "Extra Practice",
            "subject_id": classroom["subject"]["id"],
            "assignment_type": "homework",
            "max_points": 100,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    template2 = r.json()

    s1, _ = student_factory()
    s2, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-03-02",
        templates=[
            _link(classroom["template"]["id"]),
            _link(template2["id"]),
        ],
        student_ids=[s1["id"], s2["id"]],
    )
    assert r.status_code == 200, r.text
    body = r.json()["lesson"]
    # Response exposes both links.
    assert {t["template_id"] for t in body["templates"]} == {
        classroom["template"]["id"],
        template2["id"],
    }

    # 2 templates × 2 students = 4 StudentAssignments.
    sas = _linked_sas(db_session, body["id"])
    assert len(sas) == 4
    by_template = {}
    for sa in sas:
        by_template.setdefault(sa.template_id, set()).add(sa.student_id)
    assert by_template[classroom["template"]["id"]] == {s1["id"], s2["id"]}
    assert by_template[template2["id"]] == {s1["id"], s2["id"]}


def test_duplicate_template_link_rejected(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        templates=[
            _link(classroom["template"]["id"]),
            _link(classroom["template"]["id"]),
        ],
        student_ids=[student["id"]],
    )
    assert r.status_code == 400, r.text


# --- 6c. Per-link custom params ----------------------------------------------
def test_link_custom_params_applied_and_due_date_fixed(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-03-02",
        templates=[
            _link(
                classroom["template"]["id"],
                custom_due_date="2026-03-20",
                custom_max_points=50,
                custom_instructions="Show your work.",
            )
        ],
        student_ids=[student["id"]],
    )
    assert r.status_code == 200, r.text
    lesson_id = r.json()["lesson"]["id"]

    sa = _linked_sas(db_session, lesson_id)[0]
    # Per-link overrides land on the created StudentAssignment.
    assert sa.due_date == date(2026, 3, 20)  # custom, not the lesson date
    assert sa.custom_max_points == 50
    assert sa.custom_instructions == "Show your work."

    # Rescheduling the lesson does NOT move a link's custom due date.
    r = client.put(
        f"/api/lessons/{lesson_id}", json={"date": "2026-04-01"}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    db_session.expunge_all()
    assert db_session.get(StudentAssignment, sa.id).due_date == date(2026, 3, 20)


# --- 7. Delete lesson ---------------------------------------------------------
def test_delete_cascades_children_and_cleans_assignments(
    client, admin_headers, classroom, student_factory, db_session
):
    from app.models.lesson import LessonMaterial

    s1, _ = student_factory()
    s2, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        templates=[_link(classroom["template"]["id"])],
        student_ids=[s1["id"], s2["id"]],
        materials=[{"label": "Ruler", "is_gathered": False}],
    )
    lesson_id = r.json()["lesson"]["id"]
    sas = _linked_sas(db_session, lesson_id)
    graded_sa = next(sa for sa in sas if sa.student_id == s1["id"])
    ungraded_sa = next(sa for sa in sas if sa.student_id == s2["id"])
    assert _grade(client, admin_headers, graded_sa.id, 75).status_code == 200

    r = client.delete(f"/api/lessons/{lesson_id}", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert any("Kept student work" in w for w in r.json()["warnings"])

    db_session.expunge_all()
    # Materials cascade-deleted; ungraded SA deleted; graded SA orphaned & alive.
    assert (
        db_session.query(LessonMaterial)
        .filter(LessonMaterial.lesson_id == lesson_id)
        .count()
        == 0
    )
    assert _sa_by_id(db_session, ungraded_sa.id) is None
    survivor = _sa_by_id(db_session, graded_sa.id)
    assert survivor is not None and survivor.lesson_id is None


# --- 8. Material toggle + status PATCH ----------------------------------------
def test_material_toggle_and_status_patch(client, admin_headers):
    r = _create_lesson(
        client,
        admin_headers,
        materials=[{"label": "Glue", "is_gathered": False}],
    )
    lesson = r.json()["lesson"]
    lesson_id = lesson["id"]
    material_id = lesson["materials"][0]["id"]

    r = client.patch(
        f"/api/lessons/{lesson_id}/materials/{material_id}",
        json={"is_gathered": True},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["materials"][0]["is_gathered"] is True

    r = client.patch(
        f"/api/lessons/{lesson_id}/status",
        json={"status": "taught"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "taught"


# --- 9. Student session forbidden ---------------------------------------------
def test_student_session_forbidden(client, admin_headers, student_factory):
    _, student_headers = student_factory()
    r = _create_lesson(client, admin_headers, title="Owned")
    lesson_id = r.json()["lesson"]["id"]

    assert client.get("/api/lessons/", headers=student_headers).status_code == 403
    assert (
        client.get(f"/api/lessons/{lesson_id}", headers=student_headers).status_code
        == 403
    )
    assert client.get("/api/lessons/drawer", headers=student_headers).status_code == 403
    assert (
        client.post(
            "/api/lessons/rollover",
            json={"current_date": "2026-08-15"},
            headers=student_headers,
        ).status_code
        == 403
    )
    assert _create_lesson(client, student_headers, title="Nope").status_code == 403
    assert (
        client.put(
            f"/api/lessons/{lesson_id}", json={"title": "Hax"}, headers=student_headers
        ).status_code
        == 403
    )
    assert (
        client.delete(f"/api/lessons/{lesson_id}", headers=student_headers).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/lessons/{lesson_id}/status",
            json={"status": "taught"},
            headers=student_headers,
        ).status_code
        == 403
    )


# --- 10. Reorder (drag-and-drop) ---------------------------------------------
def _day_lessons(client, headers, date_iso):
    """List lessons on a day in board order (ids top-to-bottom)."""
    r = client.get(
        f"/api/lessons/?start_date={date_iso}&end_date={date_iso}", headers=headers
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_reorder_within_day(client, admin_headers):
    day = "2026-04-06"
    ids = [
        _create_lesson(client, admin_headers, title=t, date=day).json()["lesson"]["id"]
        for t in ("A", "B", "C")
    ]
    # New order: C, A, B.
    new_order = [ids[2], ids[0], ids[1]]
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": new_order},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert [lesson_row["id"] for lesson_row in body["lessons"]] == new_order
    assert [lesson_row["position"] for lesson_row in body["lessons"]] == [0, 1, 2]
    # Persisted: a fresh list returns the same order.
    assert [
        lesson_row["id"] for lesson_row in _day_lessons(client, admin_headers, day)
    ] == new_order


def test_reorder_across_days_moves_and_reschedules(
    client, admin_headers, classroom, student_factory, db_session
):
    s1, _ = student_factory()
    src, dst = "2026-04-13", "2026-04-14"
    # A lesson on dst so the moved card slots into a populated column.
    existing = _create_lesson(client, admin_headers, title="Existing", date=dst).json()[
        "lesson"
    ]["id"]
    r = _create_lesson(
        client,
        admin_headers,
        title="Mover",
        date=src,
        templates=[_link(classroom["template"]["id"])],
        student_ids=[s1["id"]],
    )
    mover = r.json()["lesson"]["id"]
    sa_id = _linked_sas(db_session, mover)[0].id

    # Drop Mover at the top of dst, above Existing.
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": dst, "lesson_ids": [mover, existing]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert [lesson_row["id"] for lesson_row in r.json()["lessons"]] == [mover, existing]

    # Mover left the source day and its linked assignment due date followed.
    assert [
        lesson_row["id"] for lesson_row in _day_lessons(client, admin_headers, src)
    ] == []
    db_session.expunge_all()
    assert db_session.get(StudentAssignment, sa_id).due_date == date(2026, 4, 14)


def test_reorder_custom_due_date_stays_fixed_on_move(
    client, admin_headers, classroom, student_factory, db_session
):
    s1, _ = student_factory()
    src, dst = "2026-04-20", "2026-04-21"
    r = _create_lesson(
        client,
        admin_headers,
        title="Fixed",
        date=src,
        templates=[_link(classroom["template"]["id"], custom_due_date="2026-05-01")],
        student_ids=[s1["id"]],
    )
    mover = r.json()["lesson"]["id"]
    sa_id = _linked_sas(db_session, mover)[0].id

    r = client.patch(
        "/api/lessons/reorder",
        json={"date": dst, "lesson_ids": [mover]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    # The per-link custom due date is a fixed override; the move does not touch it.
    db_session.expunge_all()
    assert db_session.get(StudentAssignment, sa_id).due_date == date(2026, 5, 1)


def test_reorder_missing_id_404(client, admin_headers):
    day = "2026-04-27"
    real = _create_lesson(client, admin_headers, date=day).json()["lesson"]["id"]
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": [real, 999999]},
        headers=admin_headers,
    )
    assert r.status_code == 404, r.text


def test_reorder_taught_lesson(client, admin_headers):
    day = "2026-05-04"
    a = _create_lesson(client, admin_headers, title="A", date=day).json()["lesson"][
        "id"
    ]
    b = _create_lesson(client, admin_headers, title="B", date=day).json()["lesson"][
        "id"
    ]
    # Mark A taught, then re-rank it below B.
    assert (
        client.patch(
            f"/api/lessons/{a}/status", json={"status": "taught"}, headers=admin_headers
        ).status_code
        == 200
    )
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": [b, a]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lessons = _day_lessons(client, admin_headers, day)
    assert [lesson_row["id"] for lesson_row in lessons] == [b, a]
    assert lessons[1]["status"] == "taught"


@pytest.mark.parametrize("method", ["reorder", "update"])
def test_move_taught_lesson(client, admin_headers, method):
    src, dst = "2026-05-11", "2026-05-12"
    a = _create_lesson(client, admin_headers, title="A", date=src).json()["lesson"][
        "id"
    ]
    assert (
        client.patch(
            f"/api/lessons/{a}/status", json={"status": "taught"}, headers=admin_headers
        ).status_code
        == 200
    )
    if method == "reorder":
        r = client.patch(
            "/api/lessons/reorder",
            json={"date": dst, "lesson_ids": [a]},
            headers=admin_headers,
        )
    else:
        r = client.put(f"/api/lessons/{a}", json={"date": dst}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert not _day_lessons(client, admin_headers, src)
    moved = next(
        lesson_row
        for lesson_row in _day_lessons(client, admin_headers, dst)
        if lesson_row["id"] == a
    )
    assert moved["status"] == "taught"


def test_update_keeping_same_template_link(
    client, admin_headers, classroom, student_factory
):
    """Editing a lesson while re-sending its unchanged template link must not
    trip uq_lesson_template (the UI always sends the full templates list)."""
    student, _ = student_factory()
    template_id = classroom["template"]["id"]
    r = _create_lesson(
        client,
        admin_headers,
        title="Before",
        student_ids=[student["id"]],
        templates=[_link(template_id, custom_max_points=10)],
    )
    assert r.status_code == 200, r.text
    lesson_id = r.json()["lesson"]["id"]

    r = client.put(
        f"/api/lessons/{lesson_id}",
        json={
            "title": "After",
            "templates": [_link(template_id, custom_max_points=25)],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    assert lesson["title"] == "After"
    assert [t["template_id"] for t in lesson["templates"]] == [template_id]
    assert lesson["templates"][0]["custom_max_points"] == 25


def test_reorder_with_position_hole_keeps_taught_rank(client, admin_headers):
    """Cross-day moves leave position holes; a drop that keeps a taught lesson
    in the same visual slot must compact positions, not 400."""
    day, other = "2026-05-18", "2026-05-19"
    a, b, c = (
        _create_lesson(client, admin_headers, title=t, date=day).json()["lesson"]["id"]
        for t in ("A", "B", "C")
    )
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": [a, b, c]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert (
        client.patch(
            f"/api/lessons/{c}/status", json={"status": "taught"}, headers=admin_headers
        ).status_code
        == 200
    )
    # Move B to another day, leaving a hole at position 1 on `day`.
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": other, "lesson_ids": [b]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # A drop that keeps C last (its visual slot) succeeds and compacts.
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": [a, c]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert [lesson_row["position"] for lesson_row in r.json()["lessons"]] == [0, 1]

    # The taught lesson can also change visual slots.
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": [c, a]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert [
        lesson_row["id"] for lesson_row in _day_lessons(client, admin_headers, day)
    ] == [c, a]


def test_create_appends_to_bottom_of_day(client, admin_headers):
    """New lessons append below existing (possibly reordered) cards."""
    day = "2026-05-25"
    a = _create_lesson(client, admin_headers, title="A", date=day).json()["lesson"][
        "id"
    ]
    b = _create_lesson(client, admin_headers, title="B", date=day).json()["lesson"][
        "id"
    ]
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": day, "lesson_ids": [b, a]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    c = _create_lesson(client, admin_headers, title="C", date=day).json()["lesson"][
        "id"
    ]
    assert [
        lesson_row["id"] for lesson_row in _day_lessons(client, admin_headers, day)
    ] == [b, a, c]


# --- 11. Lesson Drawer and overdue rollover ---------------------------------
def test_drawer_create_is_unscheduled_and_hidden_from_calendar(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    r = client.post(
        "/api/lessons/",
        json={
            "title": "Drawer draft",
            "date": None,
            "student_ids": [student["id"]],
            "templates": [_link(classroom["template"]["id"])],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    assert lesson["date"] is None
    assert lesson["last_scheduled_date"] is None
    assert _linked_sas(db_session, lesson["id"]) == []

    listed = client.get("/api/lessons/", headers=admin_headers)
    assert listed.status_code == 200
    assert lesson["id"] not in {item["id"] for item in listed.json()}

    drawer = client.get("/api/lessons/drawer", headers=admin_headers)
    assert drawer.status_code == 200
    # Other tests' scheduled lessons can roll into the drawer after UTC midnight.
    # Verify this draft once without assuming the shared database is otherwise empty.
    assert [item["id"] for item in drawer.json()].count(lesson["id"]) == 1


def test_stash_preserves_assignment_and_reschedule_reuses_it(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-08-10",
        student_ids=[student["id"]],
        templates=[_link(classroom["template"]["id"])],
    )
    lesson_id = r.json()["lesson"]["id"]
    original_assignment = _linked_sas(db_session, lesson_id)[0]

    r = client.put(
        f"/api/lessons/{lesson_id}", json={"date": None}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["lesson"]["last_scheduled_date"] == "2026-08-10"
    survivor = _sa_by_id(db_session, original_assignment.id)
    assert survivor.lesson_id == lesson_id
    assert survivor.due_date == date(2026, 8, 10)
    assert r.json()["warnings"] == []

    r = client.put(
        f"/api/lessons/{lesson_id}",
        json={"date": "2026-08-18"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["lesson"]["last_scheduled_date"] is None
    db_session.expunge_all()
    recreated = _linked_sas(db_session, lesson_id)
    assert len(recreated) == 1
    assert recreated[0].id == original_assignment.id
    assert recreated[0].due_date == date(2026, 8, 18)


def test_stash_keeps_protected_assignment_linked_without_warning(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-08-11",
        student_ids=[student["id"]],
        templates=[_link(classroom["template"]["id"])],
    )
    lesson_id = r.json()["lesson"]["id"]
    assignment = _linked_sas(db_session, lesson_id)[0]
    assert _grade(client, admin_headers, assignment.id, 90).status_code == 200

    r = client.put(
        f"/api/lessons/{lesson_id}", json={"date": None}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    survivor = _sa_by_id(db_session, assignment.id)
    assert survivor is not None
    assert survivor.lesson_id == lesson_id


def test_rollover_moves_only_past_untaught_lessons_and_is_idempotent(
    client, admin_headers
):
    planned = _create_lesson(
        client, admin_headers, title="Past planned", date="2001-01-10"
    ).json()["lesson"]["id"]
    ready = _create_lesson(
        client,
        admin_headers,
        title="Past ready",
        date="2001-01-11",
        status="ready",
    ).json()["lesson"]["id"]
    taught = _create_lesson(
        client, admin_headers, title="Past taught", date="2001-01-12"
    ).json()["lesson"]["id"]
    assert (
        client.patch(
            f"/api/lessons/{taught}/status",
            json={"status": "taught"},
            headers=admin_headers,
        ).status_code
        == 200
    )
    today = _create_lesson(
        client, admin_headers, title="Today", date="2001-01-15"
    ).json()["lesson"]["id"]

    r = client.post(
        "/api/lessons/rollover",
        json={"current_date": "2001-01-15"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["moved_count"] == 2
    moved = [item for item in r.json()["lessons"] if item["id"] in (planned, ready)]
    assert [item["id"] for item in moved] == [planned, ready]
    assert [item["last_scheduled_date"] for item in moved] == [
        "2001-01-10",
        "2001-01-11",
    ]
    scheduled_ids = {
        item["id"] for item in client.get("/api/lessons/", headers=admin_headers).json()
    }
    assert taught in scheduled_ids
    assert today in scheduled_ids

    again = client.post(
        "/api/lessons/rollover",
        json={"current_date": "2001-01-15"},
        headers=admin_headers,
    )
    assert again.status_code == 200
    assert again.json()["moved_count"] == 0


def test_drawer_reorder_and_taught_stash(client, admin_headers):
    existing_ids = [
        lesson["id"]
        for lesson in client.get("/api/lessons/drawer", headers=admin_headers).json()
    ]
    first = _create_lesson(client, admin_headers, title="First", date=None).json()[
        "lesson"
    ]["id"]
    second = _create_lesson(client, admin_headers, title="Second", date=None).json()[
        "lesson"
    ]["id"]
    r = client.patch(
        "/api/lessons/reorder",
        json={"date": None, "lesson_ids": [*existing_ids, second, first]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert [item["id"] for item in r.json()["lessons"]] == [
        *existing_ids,
        second,
        first,
    ]

    taught = _create_lesson(
        client, admin_headers, title="Taught", date="2026-08-15"
    ).json()["lesson"]["id"]
    assert (
        client.patch(
            f"/api/lessons/{taught}/status",
            json={"status": "taught"},
            headers=admin_headers,
        ).status_code
        == 200
    )
    r = client.put(
        f"/api/lessons/{taught}",
        json={"date": None, "status": "taught"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["lesson"]["status"] == "taught"
    assert r.json()["lesson"]["date"] is None
    assert r.json()["lesson"]["last_scheduled_date"] == "2026-08-15"

    r = client.patch(
        "/api/lessons/reorder",
        json={"date": "2026-08-16", "lesson_ids": [taught]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    moved = next(
        lesson_row for lesson_row in r.json()["lessons"] if lesson_row["id"] == taught
    )
    assert moved["status"] == "taught"
    assert moved["last_scheduled_date"] is None


@pytest.mark.parametrize("method", ["reorder", "update"])
@pytest.mark.parametrize("destination", ["2026-03-10", None])
def test_move_taught_lesson_preserves_student_work(
    client, admin_headers, classroom, student_factory, db_session, method, destination
):
    students = [student_factory()[0] for _ in range(3)]
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-03-03",
        status="taught",
        student_ids=[student["id"] for student in students],
        templates=[_link(classroom["template"]["id"])],
    )
    assert r.status_code == 200, r.text
    lesson_id = r.json()["lesson"]["id"]
    sas = {sa.student_id: sa for sa in _linked_sas(db_session, lesson_id)}
    graded_id, submitted_id, unstarted_id = [sas[s["id"]].id for s in students]
    assert _grade(client, admin_headers, graded_id, 90).status_code == 200
    submitted = db_session.get(StudentAssignment, submitted_id)
    submitted.submitted_date = datetime(2026, 3, 3, 12, tzinfo=timezone.utc)
    db_session.commit()

    if method == "reorder":
        r = client.patch(
            "/api/lessons/reorder",
            json={"date": destination, "lesson_ids": [lesson_id]},
            headers=admin_headers,
        )
    else:
        r = client.put(
            f"/api/lessons/{lesson_id}",
            json={"date": destination, "status": "taught"},
            headers=admin_headers,
        )
    assert r.status_code == 200, r.text
    assert len(r.json()["warnings"]) == (2 if destination else 0)
    lesson = client.get(f"/api/lessons/{lesson_id}", headers=admin_headers).json()
    assert lesson["date"] == destination
    assert lesson["status"] == "taught"
    for assignment_id in [graded_id, submitted_id]:
        survivor = _sa_by_id(db_session, assignment_id)
        assert survivor is not None
        assert survivor.due_date == date(2026, 3, 3)
        assert survivor.lesson_id == lesson_id
    assert _sa_by_id(db_session, graded_id).points_earned == 90
    assert _sa_by_id(db_session, submitted_id).submitted_date is not None
    unstarted = _sa_by_id(db_session, unstarted_id)
    if destination:
        assert unstarted.due_date == date(2026, 3, 10)
    else:
        assert unstarted is not None
        assert unstarted.lesson_id == lesson_id
        assert unstarted.due_date == date(2026, 3, 3)


def test_drawer_lesson_can_retain_taught_status(client, admin_headers):
    r = _create_lesson(client, admin_headers, date=None, status="taught")
    assert r.status_code == 200, r.text
    lesson_id = r.json()["lesson"]["id"]
    for status in ["ready", "taught"]:
        r = client.patch(
            f"/api/lessons/{lesson_id}/status",
            json={"status": status},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == status
        assert r.json()["date"] is None


@pytest.mark.parametrize("method", ["update", "reorder", "rollover"])
def test_drawer_round_trip_preserves_every_assignment_and_work(
    client, admin_headers, classroom, student_factory, db_session, method
):
    students = [student_factory()[0] for _ in range(5)]
    r = _create_lesson(
        client,
        admin_headers,
        date="2026-03-03",
        status="ready",
        student_ids=[s["id"] for s in students],
        templates=[
            _link(
                classroom["template"]["id"],
                custom_max_points=50,
                custom_instructions="Keep these instructions.",
            )
        ],
    )
    lesson_id = r.json()["lesson"]["id"]
    rows = sorted(_linked_sas(db_session, lesson_id), key=lambda sa: sa.student_id)
    ids = [sa.id for sa in rows]
    for sa, status in zip(
        rows,
        [
            AssignmentStatus.NOT_STARTED,
            AssignmentStatus.IN_PROGRESS,
            AssignmentStatus.SUBMITTED,
            AssignmentStatus.GRADED,
            AssignmentStatus.EXCUSED,
        ],
    ):
        sa.status = status
    progress = rows[1]
    progress.started_date = date(2026, 3, 3)
    progress.student_notes = "Don't lose my work."
    progress.time_spent_minutes = 25
    progress.extended_due_date = date(2026, 3, 20)
    db_session.add(
        AssignmentTimeEntry(
            assignment_id=progress.id,
            logged_by=progress.student_id,
            work_date=date(2026, 3, 3),
            minutes=25,
            note="Worked on paper.",
        )
    )
    rows[2].submitted_date = date(2026, 3, 3)
    rows[2].submission_notes = "Finished independently."
    rows[2].submission_artifacts = '["https://example.org/work"]'
    rows[3].is_graded = True
    rows[3].points_earned = 45
    rows[3].percentage_grade = 90
    rows[3].teacher_feedback = "Well done."
    db_session.commit()

    if method == "rollover":
        r = client.post(
            "/api/lessons/rollover",
            json={"current_date": "2026-03-04"},
            headers=admin_headers,
        )
    elif method == "reorder":
        drawer_ids = [
            lesson_row["id"]
            for lesson_row in client.get(
                "/api/lessons/drawer", headers=admin_headers
            ).json()
        ]
        r = client.patch(
            "/api/lessons/reorder",
            json={"date": None, "lesson_ids": [*drawer_ids, lesson_id]},
            headers=admin_headers,
        )
    else:
        r = client.put(
            f"/api/lessons/{lesson_id}", json={"date": None}, headers=admin_headers
        )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    db_session.expunge_all()
    assert sorted(sa.id for sa in _linked_sas(db_session, lesson_id)) == ids
    assert all(
        sa.due_date == date(2026, 3, 3) for sa in _linked_sas(db_session, lesson_id)
    )

    # Recover the forgotten taught lesson on its actual day, then move it later.
    r = client.put(
        f"/api/lessons/{lesson_id}",
        json={"date": "2026-03-03", "status": "taught"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    assert r.json()["lesson"]["status"] == "taught"
    assert r.json()["lesson"]["last_scheduled_date"] is None
    r = client.put(
        f"/api/lessons/{lesson_id}", json={"date": "2026-03-10"}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    db_session.expunge_all()
    final = sorted(_linked_sas(db_session, lesson_id), key=lambda sa: sa.student_id)
    assert [sa.id for sa in final] == ids
    assert [sa.status for sa in final] == [
        AssignmentStatus.NOT_STARTED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.SUBMITTED,
        AssignmentStatus.GRADED,
        AssignmentStatus.EXCUSED,
    ]
    assert final[1].student_notes == "Don't lose my work."
    assert final[1].time_spent_minutes == 25
    assert final[1].time_entries[0].note == "Worked on paper."
    assert final[1].extended_due_date == date(2026, 3, 20)
    assert final[1].due_date == date(2026, 3, 10)
    assert final[2].due_date == final[3].due_date == date(2026, 3, 3)
    assert final[2].submission_notes == "Finished independently."
    assert final[2].submission_artifacts == '["https://example.org/work"]'
    assert final[3].points_earned == 45
    assert final[3].teacher_feedback == "Well done."
    assert all(
        sa.custom_max_points == 50
        and sa.custom_instructions == "Keep these instructions."
        for sa in final
    )


@pytest.mark.parametrize("edit", ["student", "template", "delete"])
@pytest.mark.parametrize(
    "work", ["started", "notes", "time", "excused", "extended", "feedback", "artifacts"]
)
def test_explicit_lesson_removal_preserves_unsubmitted_work(
    client, admin_headers, classroom, student_factory, db_session, edit, work
):
    student, _ = student_factory()
    r = _create_lesson(
        client,
        admin_headers,
        student_ids=[student["id"]],
        templates=[_link(classroom["template"]["id"])],
    )
    lesson_id = r.json()["lesson"]["id"]
    sa = _linked_sas(db_session, lesson_id)[0]
    sa_id = sa.id
    if work == "started":
        sa.status = AssignmentStatus.IN_PROGRESS
        sa.started_date = date(2026, 2, 10)
    elif work == "notes":
        sa.student_notes = "An unfinished answer."
    elif work == "time":
        db_session.add(
            AssignmentTimeEntry(
                assignment_id=sa_id,
                logged_by=student["id"],
                work_date=date(2026, 2, 10),
                minutes=25,
                note="Preserve this log.",
            )
        )
    elif work == "extended":
        sa.extended_due_date = date(2026, 2, 20)
    elif work == "feedback":
        sa.teacher_feedback = "Discuss this with me."
    elif work == "artifacts":
        sa.submission_artifacts = '["https://example.org/work"]'
    else:
        sa.status = AssignmentStatus.EXCUSED
    db_session.commit()
    if edit == "delete":
        r = client.delete(f"/api/lessons/{lesson_id}", headers=admin_headers)
    else:
        body = {"student_ids": []} if edit == "student" else {"templates": []}
        r = client.put(f"/api/lessons/{lesson_id}", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["warnings"]
    survivor = _sa_by_id(db_session, sa_id)
    assert survivor is not None
    assert survivor.lesson_id is None
    if work == "time":
        assert survivor.time_entries[0].minutes == 25
    elif work == "notes":
        assert survivor.student_notes == "An unfinished answer."


@pytest.mark.parametrize(
    "timing,scheduled,count",
    [
        ("draft", True, 0),
        ("draft", False, 0),
        ("on_schedule", True, 1),
        ("on_schedule", False, 0),
        ("now", False, 1),
    ],
)
def test_explicit_assignment_timing(
    client,
    admin_headers,
    classroom,
    student_factory,
    db_session,
    timing,
    scheduled,
    count,
):
    student, _ = student_factory()
    body = dict(
        title="Timing",
        date="2026-02-10" if scheduled else None,
        student_ids=[student["id"]],
        templates=[
            _link(
                classroom["template"]["id"], assignment_timing=timing, due_offset_days=3
            )
        ],
    )
    preview = client.post("/api/lessons/impact", json=body, headers=admin_headers)
    assert preview.status_code == 200, preview.text
    assert preview.json()[0]["action"] == ("create" if count else "draft")
    r = _create_lesson(client, admin_headers, **body)
    assert r.status_code == 200, r.text
    rows = _linked_sas(db_session, r.json()["lesson"]["id"])
    assert len(rows) == count
    if count:
        assert rows[0].due_date == (date(2026, 2, 13) if scheduled else None)


def test_relative_deadline_preview_is_read_only_and_draft_preserves_published(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    body = dict(
        title="Relative deadline",
        date="2026-02-10",
        student_ids=[student["id"]],
        templates=[_link(classroom["template"]["id"], due_offset_days=2)],
    )
    r = _create_lesson(client, admin_headers, **body)
    lesson_id = r.json()["lesson"]["id"]
    sa = _linked_sas(db_session, lesson_id)[0]
    assignment_id = sa.id
    body["date"] = "2026-02-20"
    preview = client.post(
        "/api/lessons/impact",
        json={**body, "lesson_id": lesson_id},
        headers=admin_headers,
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()[0]["action"] == "move"
    assert preview.json()[0]["assignment_id"] == assignment_id
    assert preview.json()[0]["due_date"] == "2026-02-22"
    assert _sa_by_id(db_session, assignment_id).due_date == date(2026, 2, 12)
    client.put(f"/api/lessons/{lesson_id}", json=body, headers=admin_headers)
    assert _sa_by_id(db_session, assignment_id).due_date == date(2026, 2, 22)
    body["date"] = None
    body["templates"][0]["assignment_timing"] = "now"
    client.put(f"/api/lessons/{lesson_id}", json=body, headers=admin_headers)
    assert _sa_by_id(db_session, assignment_id).due_date == date(2026, 2, 22)
    body["date"] = "2026-03-01"
    body["templates"][0]["assignment_timing"] = "draft"
    client.put(f"/api/lessons/{lesson_id}", json=body, headers=admin_headers)
    assert _sa_by_id(db_session, assignment_id).due_date == date(2026, 2, 22)
    sa = _sa_by_id(db_session, assignment_id)
    sa.student_notes = "Keep my work"
    db_session.commit()
    preview = client.post(
        "/api/lessons/impact",
        json={"title": "Remove", "lesson_id": lesson_id, "deleting": True},
        headers=admin_headers,
    )
    assert preview.json()[0]["action"] == "unlink"
    assert _sa_by_id(db_session, assignment_id).lesson_id == lesson_id


def test_student_cannot_preview_teacher_assignment_changes(client, student_factory):
    _, headers = student_factory()
    assert (
        client.post(
            "/api/lessons/impact", json={"title": "Private"}, headers=headers
        ).status_code
        == 403
    )


def test_copy_creates_fresh_work_and_bulk_recovery_preserves_ids(
    client, admin_headers, classroom, student_factory, db_session
):
    student, _ = student_factory()
    original = _create_lesson(
        client,
        admin_headers,
        student_ids=[student["id"]],
        templates=[_link(classroom["template"]["id"], due_offset_days=2)],
        status="taught",
        materials=[{"label": "Workbook", "is_gathered": True}],
    ).json()["lesson"]
    sa = _linked_sas(db_session, original["id"])[0]
    original_sa_id = sa.id
    sa.student_notes = "Original work"
    sa.points_earned = 0
    sa.is_graded = True
    sa.status = AssignmentStatus.GRADED
    db_session.commit()
    r = client.post(
        "/api/lessons/batch",
        json={"lesson_ids": [original["id"]], "action": "copy", "date": "2026-02-20"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    copied = r.json()[0]["lesson"]
    assert copied["id"] != original["id"]
    assert copied["status"] == "planned"
    assert copied["materials"][0]["is_gathered"] is False
    fresh = _linked_sas(db_session, copied["id"])[0]
    assert fresh.id != original_sa_id
    assert fresh.status == AssignmentStatus.NOT_STARTED
    assert fresh.points_earned is None and not fresh.student_notes
    assert fresh.due_date == date(2026, 2, 22)
    client.put(
        f'/api/lessons/{original["id"]}', json={"date": None}, headers=admin_headers
    )
    r = client.post(
        "/api/lessons/batch",
        json={"lesson_ids": [original["id"]], "action": "restore_taught"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()[0]["lesson"]["date"] == "2026-02-10"
    kept = _sa_by_id(db_session, original_sa_id)
    assert kept.points_earned == 0 and kept.student_notes == "Original work"
    assert kept.lesson_id == original["id"]


def test_bulk_invalid_source_does_not_partially_move(
    client, admin_headers, classroom, db_session
):
    lesson = _create_lesson(client, admin_headers).json()["lesson"]
    r = client.post(
        "/api/lessons/batch",
        json={
            "lesson_ids": [lesson["id"], 99999999],
            "action": "schedule",
            "date": "2026-03-01",
        },
        headers=admin_headers,
    )
    assert r.status_code == 404
    assert (
        client.get(f'/api/lessons/{lesson["id"]}', headers=admin_headers).json()["date"]
        == "2026-02-10"
    )


def test_copy_drawer_plan_uses_explicit_students_without_changing_original(
    client, admin_headers, classroom, student_factory, db_session
):
    original_student, _ = student_factory()
    selected_student, _ = student_factory()
    original = _create_lesson(
        client,
        admin_headers,
        student_ids=[original_student["id"]],
        templates=[_link(classroom["template"]["id"], due_offset_days=3)],
    ).json()["lesson"]
    original_ids = [row.id for row in _linked_sas(db_session, original["id"])]
    client.put(
        f"/api/lessons/{original['id']}", json={"date": None}, headers=admin_headers
    )
    response = client.post(
        "/api/lessons/batch",
        json={
            "lesson_ids": [original["id"]],
            "action": "copy",
            "date": "2026-03-04",
            "student_ids": [selected_student["id"]],
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    copy = response.json()[0]["lesson"]
    assignments = _linked_sas(db_session, copy["id"])
    assert [(row.student_id, row.due_date) for row in assignments] == [
        (selected_student["id"], date(2026, 3, 7))
    ]
    assert [row.id for row in _linked_sas(db_session, original["id"])] == original_ids
    assert (
        client.get(f"/api/lessons/{original['id']}", headers=admin_headers).json()[
            "date"
        ]
        is None
    )
