"""Integration tests for API-key access to the AI-workflow surface.

These exercise the dual-auth endpoints that external/AI workflows rely on:
assignment discovery + authoring, assignment + attendance read/write, and the
`/api/meta` discovery contract. For each capability we assert (a) the call
succeeds with the right permission, (b) it is rejected (403) without it, and
(c) records authored by an API key carry null audit fields (no backing user).

Requires a reachable PostgreSQL instance (see tests/conftest.py).
"""
import uuid
from datetime import date

import pytest

from app.crud.api_keys import create_api_key
from app.enums import UserRole
from app.models.assignment_type import AssignmentTypeConfig
from app.models.subject import Subject
from app.models.term import Term
from app.models.user import User


@pytest.fixture()
def seeded(db_session):
    """Create the minimal data graph + API keys an agent workflow needs.

    Tables persist for the whole session, so every unique-constrained value is
    suffixed with a per-test token to keep tests independent.
    """
    tok = uuid.uuid4().hex[:8]
    admin = User(
        email=f"apiadmin-{tok}@test.local",
        username=f"apiadmin-{tok}",
        hashed_password="x",
        first_name="Api",
        last_name="Admin",
        role=UserRole.ADMIN,
    )
    student = User(
        email=f"apistudent-{tok}@test.local",
        username=f"apistudent-{tok}",
        hashed_password="x",
        first_name="Api",
        last_name="Student",
        role=UserRole.STUDENT,
    )
    subject = Subject(name=f"Mathematics-{tok}", color="#3B82F6")
    # Only one term may be active at a time across the shared DB, so seed this
    # one inactive and activate it for the assign test explicitly.
    term = Term(
        name=f"Test Term {tok}",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        academic_year="2026-2027",
        is_active=False,
    )
    type_key = f"homework-{tok}"
    # Template creation validates the type key against this table.
    atype = AssignmentTypeConfig(key=type_key, name="Homework", is_active=True)
    db_session.add_all([admin, student, subject, term, atype])
    db_session.commit()
    for obj in (admin, student, subject, term):
        db_session.refresh(obj)

    def mint(*perms):
        _, full_key = create_api_key(
            db_session, name=f"key-{tok}-{'-'.join(perms) or 'none'}", permissions=list(perms), creator_id=admin.id
        )
        return full_key

    def activate_term():
        term.is_active = True
        db_session.commit()

    return {
        "admin": admin,
        "student": student,
        "subject": subject,
        "term": term,
        "type_key": type_key,
        "mint": mint,
        "activate_term": activate_term,
    }


def _hdr(key: str) -> dict:
    return {"X-API-Key": key}


# --------------------------------------------------------------------------
# Assignment authoring + discovery
# --------------------------------------------------------------------------


def test_create_template_requires_write_permission(client, seeded):
    body = {"name": "Algebra HW", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"]}

    # Without the permission → 403
    r = client.post("/api/assignments/templates", json=body, headers=_hdr(seeded["mint"]("assignments:read")))
    assert r.status_code == 403, r.text

    # With the permission → created, and created_by is null (no backing user).
    r = client.post("/api/assignments/templates", json=body, headers=_hdr(seeded["mint"]("assignments:write")))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created_by"] is None
    assert data["name"] == "Algebra HW"


def test_assign_and_discover_assignment_via_api_key(client, seeded):
    write = seeded["mint"]("assignments:write")
    read = seeded["mint"]("assignments:read")
    student_id = seeded["student"].id

    # Author a template.
    r = client.post(
        "/api/assignments/templates",
        json={"name": "Reading", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"]},
        headers=_hdr(write),
    )
    template_id = r.json()["id"]

    # Assigning requires an active term.
    seeded["activate_term"]()

    # Assign it (write). assigned_by must be null for an API-key actor.
    r = client.post(
        "/api/assignments/assign",
        json={"template_id": template_id, "student_ids": [student_id]},
        headers=_hdr(write),
    )
    assert r.status_code == 200, r.text
    created = r.json()["created_assignments"]
    assert len(created) == 1
    assert created[0]["assigned_by"] is None

    # Discover it via the grading/discovery endpoint (read).
    r = client.get(f"/api/assignments/all-assignments?student_id={student_id}", headers=_hdr(read))
    assert r.status_code == 200, r.text
    assert any(a["template_id"] == template_id for a in r.json())

    # The same discovery endpoint is rejected without the read permission.
    r = client.get(f"/api/assignments/all-assignments?student_id={student_id}", headers=_hdr(write))
    assert r.status_code == 403, r.text


def test_list_templates_via_api_key(client, seeded):
    write = seeded["mint"]("assignments:write")
    read = seeded["mint"]("assignments:read")
    client.post(
        "/api/assignments/templates",
        json={"name": "Listed", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"]},
        headers=_hdr(write),
    )
    r = client.get("/api/assignments/templates", headers=_hdr(read))
    assert r.status_code == 200, r.text
    assert any(t["name"] == "Listed" for t in r.json())


def test_complete_assignment_via_api_key(client, seeded):
    """The /complete endpoint accepts a JSON object body (regression: it used
    to demand a bare JSON list, 422-ing every real client)."""
    write = seeded["mint"]("assignments:write")

    # Author + assign so there is something to complete.
    r = client.post(
        "/api/assignments/templates",
        json={"name": "Essay", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"], "max_points": 10},
        headers=_hdr(write),
    )
    template_id = r.json()["id"]
    seeded["activate_term"]()
    r = client.post(
        "/api/assignments/assign",
        json={"template_id": template_id, "student_ids": [seeded["student"].id]},
        headers=_hdr(write),
    )
    assignment_id = r.json()["created_assignments"][0]["id"]

    # Rejected without assignments:write.
    r = client.post(
        f"/api/assignments/student-assignments/{assignment_id}/complete",
        json={},
        headers=_hdr(seeded["mint"]("assignments:read")),
    )
    assert r.status_code == 403, r.text

    # Notes and artifacts arrive via the object body.
    r = client.post(
        f"/api/assignments/student-assignments/{assignment_id}/complete",
        json={"submission_notes": "Done via MCP", "submission_artifacts": ["https://example.com/essay.pdf"]},
        headers=_hdr(write),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "submitted"
    assert data["submission_notes"] == "Done via MCP"
    assert data["submission_artifacts"] == ["https://example.com/essay.pdf"]

    # An empty object body (no notes) is also valid.
    r = client.post(
        f"/api/assignments/student-assignments/{assignment_id}/complete",
        json={},
        headers=_hdr(write),
    )
    assert r.status_code == 200, r.text


# --------------------------------------------------------------------------
# Attendance read/write
# --------------------------------------------------------------------------


def test_attendance_bulk_write_and_read_via_api_key(client, seeded):
    write = seeded["mint"]("attendance:write")
    read = seeded["mint"]("attendance:read")
    student_id = seeded["student"].id

    body = {"date": "2026-03-02", "student_ids": [student_id], "status": "present"}

    # Rejected without write.
    r = client.post("/api/attendance/bulk", json=body, headers=_hdr(read))
    assert r.status_code == 403, r.text

    # Recorded with write.
    r = client.post("/api/attendance/bulk", json=body, headers=_hdr(write))
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1

    # Readable with read; rejected without it.
    r = client.get(f"/api/attendance/?student_id={student_id}", headers=_hdr(read))
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1

    # A key that lacks attendance:read is forbidden.
    r2 = client.get(f"/api/attendance/?student_id={student_id}", headers=_hdr(seeded["mint"]("students:read")))
    assert r2.status_code == 403, r2.text


# --------------------------------------------------------------------------
# Student roster
# --------------------------------------------------------------------------


def test_list_students_via_api_key(client, seeded):
    # Rejected without students:read.
    r = client.get("/api/users/students", headers=_hdr(seeded["mint"]("attendance:read")))
    assert r.status_code == 403, r.text

    # The canonical roster endpoint works with students:read.
    r = client.get("/api/users/students", headers=_hdr(seeded["mint"]("students:read")))
    assert r.status_code == 200, r.text
    assert any(s["id"] == seeded["student"].id for s in r.json())


# --------------------------------------------------------------------------
# Discovery contract
# --------------------------------------------------------------------------


def test_meta_advertises_new_permissions(client):
    r = client.get("/api/meta")
    assert r.status_code == 200, r.text
    perms = set(r.json()["permissions"])
    assert {
        # existing
        "students:read",
        "assignments:read", "assignments:write", "assignments:grade",
        "assignment_types:read", "assignment_types:write",
        "attendance:read", "attendance:write",
        "points:read", "points:write",
        # new
        "terms:read", "terms:write",
        "subjects:read", "subjects:write",
        "reports:read",
        "journal:read", "journal:write", "journal:moderate",
        "activity:read",
        "settings:read", "settings:write",
        "performance:read", "performance:write",
        "backup:export", "backup:import",
        "api_keys:read",
    } <= perms
    assert r.json()["on_behalf_of_header"] == "X-On-Behalf-Of"


# --------------------------------------------------------------------------
# On-behalf-of attribution (X-On-Behalf-Of)
# --------------------------------------------------------------------------


def _obo(key: str, who) -> dict:
    return {"X-API-Key": key, "X-On-Behalf-Of": str(who)}


def test_on_behalf_of_attributes_template_create_by_id_and_username(client, seeded):
    write = seeded["mint"]("assignments:write")
    admin = seeded["admin"]
    body = {"name": "Owned", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"]}

    # By numeric ID.
    r = client.post("/api/assignments/templates", json=body, headers=_obo(write, admin.id))
    assert r.status_code == 200, r.text
    assert r.json()["created_by"] == admin.id

    # By username.
    body2 = {**body, "name": "Owned2"}
    r = client.post("/api/assignments/templates", json=body2, headers=_obo(write, admin.username))
    assert r.status_code == 200, r.text
    assert r.json()["created_by"] == admin.id


def test_on_behalf_of_attributes_points_adjust(client, seeded):
    write = seeded["mint"]("points:write")
    admin = seeded["admin"]
    body = {"student_id": seeded["student"].id, "amount": 5, "notes": "Great work"}

    r = client.post("/api/points/adjust", json=body, headers=_obo(write, admin.username))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["admin_id"] == admin.id
    assert data["admin_name"] == f"{admin.first_name} {admin.last_name}"


def test_on_behalf_of_attributes_grade(client, seeded, db_session):
    write = seeded["mint"]("assignments:write")
    grade = seeded["mint"]("assignments:grade")
    admin = seeded["admin"]

    # Author + assign so there is something to grade.
    r = client.post(
        "/api/assignments/templates",
        json={"name": "Quiz", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"], "max_points": 10},
        headers=_hdr(write),
    )
    template_id = r.json()["id"]
    seeded["activate_term"]()
    r = client.post(
        "/api/assignments/assign",
        json={"template_id": template_id, "student_ids": [seeded["student"].id]},
        headers=_hdr(write),
    )
    assignment_id = r.json()["created_assignments"][0]["id"]

    # Grade on behalf of the admin.
    r = client.post(
        f"/api/integrations/assignments/{assignment_id}/grade",
        json={"points_earned": 8},
        headers=_obo(grade, admin.username),
    )
    assert r.status_code == 200, r.text

    from app.models.assignment import StudentAssignment

    db_session.expire_all()
    row = db_session.query(StudentAssignment).filter(StudentAssignment.id == assignment_id).first()
    assert row.graded_by == admin.id


def test_on_behalf_of_rejects_non_admin_and_unknown(client, seeded):
    write = seeded["mint"]("assignments:write")
    body = {"name": "Nope", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"]}

    # A student is not an admin → 400, nothing written.
    r = client.post("/api/assignments/templates", json=body, headers=_obo(write, seeded["student"].username))
    assert r.status_code == 400, r.text

    # An unknown identifier → 400.
    r = client.post("/api/assignments/templates", json=body, headers=_obo(write, "no-such-user-xyz"))
    assert r.status_code == 400, r.text


def test_on_behalf_of_rejects_inactive_admin(client, seeded, db_session):
    write = seeded["mint"]("assignments:write")
    inactive = User(
        email=f"inactive-{seeded['admin'].username}@test.local",
        username=f"inactive-{seeded['admin'].username}",
        hashed_password="x",
        first_name="In",
        last_name="Active",
        role=UserRole.ADMIN,
        is_active=False,
    )
    db_session.add(inactive)
    db_session.commit()

    body = {"name": "Nope2", "subject_id": seeded["subject"].id, "assignment_type": seeded["type_key"]}
    r = client.post("/api/assignments/templates", json=body, headers=_obo(write, inactive.username))
    assert r.status_code == 400, r.text


# --------------------------------------------------------------------------
# Expanded coverage: per-router permission enforcement
# --------------------------------------------------------------------------


def test_permission_matrix_for_expanded_read_endpoints(client, seeded):
    """Each newly covered read endpoint honors exactly its own permission."""
    cases = [
        ("/api/terms/", "terms:read"),
        ("/api/subjects/", "subjects:read"),
        ("/api/assignment-types/", "assignment_types:read"),
        ("/api/settings/", "settings:read"),
        ("/api/journal/entries", "journal:read"),
        ("/api/activity/recent", "activity:read"),
        ("/api/reports/admin/overview", "reports:read"),
        ("/api/performance/stats", "performance:read"),
        ("/api/admin/api-keys/", "api_keys:read"),
    ]
    wrong = seeded["mint"]("students:read")
    for url, perm in cases:
        r = client.get(url, headers=_hdr(wrong))
        assert r.status_code == 403, f"{url} without {perm}: {r.status_code} {r.text}"
        r = client.get(url, headers=_hdr(seeded["mint"](perm)))
        assert r.status_code == 200, f"{url} with {perm}: {r.status_code} {r.text}"


# --------------------------------------------------------------------------
# Journal writes: NOT NULL author_id requires attribution
# --------------------------------------------------------------------------


def test_journal_entry_via_api_key_requires_on_behalf_of(client, seeded):
    key = seeded["mint"]("journal:write")
    admin = seeded["admin"]
    body = {"title": "Note", "content": "From MCP", "student_id": seeded["student"].id}

    # Without attribution → 400 (author_id is NOT NULL, no user to attribute to).
    r = client.post("/api/journal/entries", json=body, headers=_hdr(key))
    assert r.status_code == 400, r.text

    # With attribution → created and attributed to the admin.
    r = client.post("/api/journal/entries", json=body, headers=_obo(key, admin.id))
    assert r.status_code == 200, r.text
    assert r.json()["author_name"] == f"{admin.first_name} {admin.last_name}"


def test_journal_reply_via_api_key_requires_on_behalf_of(client, seeded):
    write = seeded["mint"]("journal:write")
    moderate = seeded["mint"]("journal:moderate")
    admin = seeded["admin"]

    r = client.post(
        "/api/journal/entries",
        json={"title": "Entry", "content": "text", "student_id": seeded["student"].id},
        headers=_obo(write, admin.id),
    )
    entry_id = r.json()["id"]

    r = client.post(
        f"/api/journal/entries/{entry_id}/replies",
        json={"text": "Nice work"},
        headers=_hdr(moderate),
    )
    assert r.status_code == 400, r.text

    r = client.post(
        f"/api/journal/entries/{entry_id}/replies",
        json={"text": "Nice work"},
        headers=_obo(moderate, admin.id),
    )
    assert r.status_code == 200, r.text
    assert r.json()["author_name"] == f"{admin.first_name} {admin.last_name}"


# --------------------------------------------------------------------------
# Activity feed: API keys always get the admin-scope feed
# --------------------------------------------------------------------------


def test_activity_feed_attributed_api_key_sees_all_activity(client, seeded):
    key = seeded["mint"]("attendance:write", "activity:read")
    student = seeded["student"]

    r = client.post(
        "/api/attendance/bulk",
        json={"date": str(date.today()), "student_ids": [student.id], "status": "present"},
        headers=_hdr(key),
    )
    assert r.status_code == 200, r.text

    # An attributed key must get the full feed, not a per-user view scoped to
    # the acting admin's (empty) student activity.
    r = client.get("/api/activity/recent", headers=_obo(key, seeded["admin"].id))
    assert r.status_code == 200, r.text
    names = [a.get("student_name") for a in r.json()["activities"]]
    assert f"{student.first_name} {student.last_name}" in names


# --------------------------------------------------------------------------
# "My" endpoints are session-identity sugar — API keys are rejected
# --------------------------------------------------------------------------


def test_my_endpoints_reject_api_keys(client, seeded, db_session):
    from app.models.points import StudentPoints

    admin = seeded["admin"]
    points_key = seeded["mint"]("points:read")
    assignments_key = seeded["mint"]("assignments:read")
    reports_key = seeded["mint"]("reports:read")

    cases = [
        ("/api/points/my-balance", points_key),
        ("/api/points/my-ledger", points_key),
        ("/api/assignments/my-assignments", assignments_key),
        ("/api/reports/student/overview", reports_key),
        ("/api/reports/student/term-grades", reports_key),
        ("/api/reports/student/subject-performance", reports_key),
    ]
    for url, key in cases:
        for headers in (_hdr(key), _obo(key, admin.id)):
            r = client.get(url, headers=headers)
            assert r.status_code == 403, f"{url}: {r.status_code} {r.text}"

    # Regression: /my-balance used to get_or_create a StudentPoints row for the
    # on-behalf-of admin.
    assert (
        db_session.query(StudentPoints).filter(StudentPoints.student_id == admin.id).first()
        is None
    )


# --------------------------------------------------------------------------
# Permission registry consistency
# --------------------------------------------------------------------------


def test_permission_descriptions_match_available_permissions():
    from app.crud.api_keys import AVAILABLE_PERMISSIONS
    from app.schemas.api_key import PERMISSION_DESCRIPTIONS

    assert set(PERMISSION_DESCRIPTIONS) == set(AVAILABLE_PERMISSIONS)
