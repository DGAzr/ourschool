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
# Discovery contract
# --------------------------------------------------------------------------


def test_meta_advertises_new_permissions(client):
    r = client.get("/api/meta")
    assert r.status_code == 200, r.text
    perms = set(r.json()["permissions"])
    assert {"assignments:write", "attendance:read", "attendance:write"} <= perms
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
