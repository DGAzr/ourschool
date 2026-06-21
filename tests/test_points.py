"""Unit tests for idempotent assignment-points syncing."""
from app.crud import points as points_crud
from app.models.user import User
from app.enums import UserRole


def _make_student(db, suffix="1"):
    student = User(
        email=f"pts{suffix}@test.local",
        username=f"ptsuser{suffix}",
        hashed_password="x",
        first_name="P",
        last_name="S",
        role=UserRole.STUDENT,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def test_set_assignment_points_first_award(db_session):
    student = _make_student(db_session, "a")
    points_crud.set_assignment_points(db_session, student.id, 1001, 10, "HW")
    db_session.commit()
    sp = points_crud.get_or_create_student_points(db_session, student.id)
    assert sp.current_balance == 10
    assert sp.total_earned == 10


def test_set_assignment_points_regrade_is_delta(db_session):
    student = _make_student(db_session, "b")
    points_crud.set_assignment_points(db_session, student.id, 2002, 10, "HW")
    db_session.commit()
    # Re-grade lower: balance should reflect the new score, not 10+8.
    points_crud.set_assignment_points(db_session, student.id, 2002, 8, "HW")
    db_session.commit()
    sp = points_crud.get_or_create_student_points(db_session, student.id)
    assert sp.current_balance == 8
    assert sp.total_earned == 8


def test_set_assignment_points_rounds_fractional(db_session):
    student = _make_student(db_session, "c")
    # 8.5 should round to 9 instead of silently failing on an int field.
    txn = points_crud.set_assignment_points(db_session, student.id, 3003, 8.5, "HW")
    db_session.commit()
    assert txn is not None
    sp = points_crud.get_or_create_student_points(db_session, student.id)
    assert sp.current_balance == 9


def test_set_assignment_points_noop_when_unchanged(db_session):
    student = _make_student(db_session, "d")
    points_crud.set_assignment_points(db_session, student.id, 4004, 5, "HW")
    db_session.commit()
    # Same score again → no new transaction.
    txn = points_crud.set_assignment_points(db_session, student.id, 4004, 5, "HW")
    assert txn is None


def test_points_enabled_by_default(db_session):
    assert points_crud.is_points_system_enabled(db_session) is True
