"""End-to-end grading tests: grade flow, points sync, term-grade math."""
import pytest

from app.crud import points as points_crud
from app.models.term import StudentTermGrade


def _grade(client, headers, assignment_id, points, **extra):
    return client.post(
        f"/api/assignments/student-assignments/{assignment_id}/grade",
        json={"points_earned": points, **extra},
        headers=headers,
    )


def test_grade_flow_sets_grade_letter_and_syncs_points(
    client, admin_headers, classroom, student_factory, assign, db_session
):
    student, _ = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    r = _grade(client, admin_headers, sa["id"], 85, teacher_feedback="nice work")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["points_earned"] == 85
    assert body["is_graded"] is True
    assert body["status"] == "graded"
    assert body["percentage_grade"] == pytest.approx(85.0)
    assert body["letter_grade"]  # derived from the grade scale when not supplied
    assert body["teacher_feedback"] == "nice work"

    sp = points_crud.get_or_create_student_points(db_session, student["id"])
    assert sp.current_balance == 85


def test_regrade_updates_points_as_delta(
    client, admin_headers, classroom, student_factory, assign, db_session
):
    student, _ = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    assert _grade(client, admin_headers, sa["id"], 90).status_code == 200
    assert _grade(client, admin_headers, sa["id"], 70).status_code == 200

    db_session.expire_all()
    sp = points_crud.get_or_create_student_points(db_session, student["id"])
    assert sp.current_balance == 70  # not 90 + 70


def test_grade_cannot_exceed_max_points(
    client, admin_headers, classroom, student_factory, assign
):
    student, _ = student_factory()
    sa = assign(classroom["template"]["id"], student["id"])

    r = _grade(client, admin_headers, sa["id"], 150)
    assert r.status_code == 400, r.text


def test_bulk_grade(client, admin_headers, classroom, student_factory, assign):
    student, _ = student_factory()
    sa1 = assign(classroom["template"]["id"], student["id"])
    sa2 = assign(classroom["template"]["id"], student["id"])

    r = client.post(
        "/api/assignments/bulk-grade",
        json=[
            {"assignment_id": sa1["id"], "points_earned": 80},
            {"assignment_id": sa2["id"], "points_earned": 90},
        ],
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    results = r.json()
    assert len(results) == 2
    assert all(item["success"] for item in results), results


def test_term_grade_is_points_weighted(
    client, admin_headers, classroom, student_factory, assign, db_session
):
    """Two graded assignments (80/100, 90/100) → term grade 170/200 = 85%.

    Due dates must fall inside the classroom term — assignments bucket into
    terms by effective due date.
    """
    student, _ = student_factory()
    sa1 = assign(classroom["template"]["id"], student["id"], due_date="2026-03-01")
    sa2 = assign(classroom["template"]["id"], student["id"], due_date="2026-04-01")

    assert _grade(client, admin_headers, sa1["id"], 80).status_code == 200
    assert _grade(client, admin_headers, sa2["id"], 90).status_code == 200

    db_session.expire_all()
    grade = (
        db_session.query(StudentTermGrade)
        .filter(StudentTermGrade.student_id == student["id"])
        .one()
    )
    assert grade.current_points_earned == pytest.approx(170.0)
    assert grade.current_points_possible == pytest.approx(200.0)
    assert grade.current_percentage == pytest.approx(85.0)
