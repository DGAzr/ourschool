"""Pytest fixtures for OurSchool API smoke tests.

Requires a reachable PostgreSQL instance. Point DATABASE_URL (or
TEST_DATABASE_URL) at a throwaway database; tables are created/dropped per
session via the ORM metadata. SECRET_KEY must also be set.
"""
import itertools
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL/TEST_DATABASE_URL not set; skipping DB tests")
    return url


@pytest.fixture(scope="session")
def engine():
    os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-123456")
    os.environ["DATABASE_URL"] = _database_url()

    from app.core.database import Base
    # Import models so all tables register on the metadata.
    import app.models  # noqa: F401

    eng = create_engine(os.environ["DATABASE_URL"])
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(engine):
    from app.main import app
    from app.core.database import get_db

    Session = sessionmaker(bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_token(client):
    """Create the first user (admin) and return a bearer token."""
    client.post(
        "/api/users/",
        json={
            "email": "admin@test.local",
            "username": "admin",
            "first_name": "Ad",
            "last_name": "Min",
            "role": "admin",
            "password": "adminpass123",
        },
    )
    r = client.post(
        "/api/auth/login", data={"username": "admin", "password": "adminpass123"}
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# Tables persist for the whole test session, so every created entity needs a
# unique name/username across all test files.
_unique_seq = itertools.count(1)


@pytest.fixture()
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def student_factory(client, admin_headers):
    """Create a student (as admin) and log them in.

    Returns a callable producing (student_json, auth_headers) tuples.
    """

    def make(password="studentpass123"):
        n = next(_unique_seq)
        r = client.post(
            "/api/users/",
            json={
                "email": f"student{n}@test.local",
                "username": f"student{n}",
                "first_name": "Stu",
                "last_name": f"Dent{n}",
                "role": "student",
                "password": password,
            },
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        student = r.json()
        r = client.post(
            "/api/auth/login",
            data={"username": student["username"], "password": password},
        )
        assert r.status_code == 200, r.text
        return student, {"Authorization": f"Bearer {r.json()['access_token']}"}

    return make


@pytest.fixture()
def classroom(client, admin_headers, db_session):
    """Subject + 'homework' assignment type + active term (auto-linked) + template."""
    from app.models.assignment_type import AssignmentTypeConfig

    if (
        db_session.query(AssignmentTypeConfig)
        .filter(AssignmentTypeConfig.key == "homework")
        .first()
        is None
    ):
        db_session.add(
            AssignmentTypeConfig(key="homework", name="Homework", is_active=True)
        )
        db_session.commit()

    n = next(_unique_seq)
    r = client.post(
        "/api/subjects/", json={"name": f"Subject {n}"}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    subject = r.json()

    r = client.post(
        "/api/terms/",
        json={
            "name": f"Term {n}",
            "start_date": "2026-01-05",
            "end_date": "2026-06-05",
            "academic_year": "2025-2026",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    term = r.json()
    r = client.post(f"/api/terms/{term['id']}/activate", headers=admin_headers)
    assert r.status_code == 200, r.text
    r = client.post(
        f"/api/terms/{term['id']}/auto-link-subjects", headers=admin_headers
    )
    assert r.status_code == 200, r.text

    r = client.post(
        "/api/assignments/templates",
        json={
            "name": f"Worksheet {n}",
            "subject_id": subject["id"],
            "assignment_type": "homework",
            "max_points": 100,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return {"subject": subject, "term": term, "template": r.json()}


@pytest.fixture()
def assign(client, admin_headers):
    """Assign a template to a student; returns the created student assignment."""

    def do(template_id, student_id, **kwargs):
        r = client.post(
            "/api/assignments/assign",
            json={
                "template_id": template_id,
                "student_ids": [student_id],
                **kwargs,
            },
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success_count"] == 1, body
        return body["created_assignments"][0]

    return do
