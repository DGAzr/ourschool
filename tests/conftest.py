"""Pytest fixtures for OurSchool API smoke tests.

Requires a reachable PostgreSQL instance. Point DATABASE_URL (or
TEST_DATABASE_URL) at a throwaway database; tables are created/dropped per
session via the ORM metadata. SECRET_KEY must also be set.
"""
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
