"""Missing evidence must never masquerade as a failing grade or growth."""

from datetime import date
from app.crud.reports.overview import get_student_report, get_admin_report
from app.crud.reports.shared import _compute_trend_int
from app.enums import AssignmentStatus
from app.models.assignment import StudentAssignment
from app.models.term import Term


def test_no_grade_and_genuine_zero_are_distinct(db_session, student_factory, classroom):
    student, _ = student_factory()
    report = get_student_report(db_session, student["id"])
    assert report.average_grade is None
    assert report.current_term_grade is None
    assert report.trend is None
    row = next(
        row
        for row in get_admin_report(db_session).students_glance
        if row.student_id == student["id"]
    )
    assert row.grade is None and row.letter is None and row.trend is None
    assert row.status == "Gathering evidence"
    db_session.add(
        StudentAssignment(
            template_id=classroom["template"]["id"],
            student_id=student["id"],
            assigned_date=date(2026, 2, 10),
            points_earned=0,
            is_graded=True,
            status=AssignmentStatus.GRADED,
        )
    )
    db_session.commit()
    report = get_student_report(db_session, student["id"])
    assert report.average_grade == 0
    row = next(
        row
        for row in get_admin_report(db_session).students_glance
        if row.student_id == student["id"]
    )
    assert row.grade == 0 and row.letter == "F"
    assert row.status == "Gathering evidence"


def test_empty_prior_term_has_no_performance_delta(db_session):
    active_ids = [t.id for t in db_session.query(Term).filter(Term.is_active).all()]
    db_session.query(Term).update({Term.is_active: False})
    prior = Term(
        name="Empty comparison",
        start_date=date(2100, 1, 1),
        end_date=date(2100, 5, 1),
        academic_year="2100",
        is_active=False,
    )
    current = Term(
        name="Empty current",
        start_date=date(2100, 6, 1),
        end_date=date(2100, 12, 1),
        academic_year="2100",
        is_active=True,
    )
    db_session.add_all([prior, current])
    db_session.commit()
    try:
        report = get_admin_report(db_session)
        for kpi in report.kpis[:3]:
            assert kpi.delta == "No previous-term data"
            assert kpi.delta_positive is None
    finally:
        db_session.delete(current)
        db_session.delete(prior)
        db_session.query(Term).filter(Term.id.in_(active_ids)).update(
            {Term.is_active: True}, synchronize_session=False
        )
        db_session.commit()


def test_trend_requires_two_observed_periods():
    assert _compute_trend_int([]) is None
    assert _compute_trend_int([0]) is None
    assert _compute_trend_int([0, 0]) == 0
