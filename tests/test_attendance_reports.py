"""Attendance report math and authorization tests."""
import pytest

# A Monday–Friday school week with one record per day.
WEEK = [
    ("2026-03-02", "present"),
    ("2026-03-03", "present"),
    ("2026-03-04", "late"),
    ("2026-03-05", "absent"),
    ("2026-03-06", "excused"),
]


def _record_week(client, admin_headers, student_id):
    for day, status in WEEK:
        r = client.post(
            "/api/attendance/",
            json={"student_id": student_id, "date": day, "status": status},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text


def test_attendance_report_math(client, admin_headers, student_factory):
    student, _ = student_factory()
    _record_week(client, admin_headers, student["id"])

    r = client.get(
        f"/api/reports/attendance/student/{student['id']}",
        params={"start_date": "2026-03-02", "end_date": "2026-03-06"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    summary = r.json()["summary"]

    assert summary["total_school_days"] == 5  # weekends skipped by default
    assert summary["present_days"] == 2
    assert summary["late_days"] == 1
    assert summary["absent_days"] == 1
    assert summary["excused_days"] == 1
    # present + late + excused (counted by default) over school days: 4/5
    assert summary["attendance_rate"] == pytest.approx(80.0)


def test_unrecorded_days_lower_the_rate(client, admin_headers, student_factory):
    """Only 1 of 5 school days recorded → rate uses the 5-day denominator."""
    student, _ = student_factory()
    r = client.post(
        "/api/attendance/",
        json={"student_id": student["id"], "date": "2026-03-02", "status": "present"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    r = client.get(
        f"/api/reports/attendance/student/{student['id']}",
        params={"start_date": "2026-03-02", "end_date": "2026-03-06"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    summary = r.json()["summary"]
    assert summary["total_school_days"] == 5
    assert summary["attendance_rate"] == pytest.approx(20.0)


def test_student_can_view_own_report_but_not_others(
    client, admin_headers, student_factory
):
    student1, student1_headers = student_factory()
    student2, _ = student_factory()
    _record_week(client, admin_headers, student1["id"])

    r = client.get(
        f"/api/reports/attendance/student/{student1['id']}",
        params={"start_date": "2026-03-02", "end_date": "2026-03-06"},
        headers=student1_headers,
    )
    assert r.status_code == 200, r.text

    r = client.get(
        f"/api/reports/attendance/student/{student2['id']}",
        params={"start_date": "2026-03-02", "end_date": "2026-03-06"},
        headers=student1_headers,
    )
    assert r.status_code == 403, r.text
