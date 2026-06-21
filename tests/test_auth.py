"""Auth, authorization and hardening smoke tests."""


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_security_headers_present(client):
    r = client.get("/health")
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert r.headers.get("X-Content-Type-Options") == "nosniff"


def test_errors_endpoint_requires_admin(client):
    r = client.get("/errors/recent")
    assert r.status_code == 401


def test_errors_endpoint_allows_admin(client, admin_token):
    r = client.get("/errors/recent", headers=_auth(admin_token))
    assert r.status_code == 200


def test_login_wrong_password(client, admin_token):
    r = client.post(
        "/api/auth/login", data={"username": "admin", "password": "wrong"}
    )
    assert r.status_code == 401


def test_token_has_session_start_claim(admin_token):
    from app.core.security import decode_token

    assert "sst" in decode_token(admin_token)


def test_weak_password_rejected(client, admin_token):
    r = client.post(
        "/api/users/",
        json={
            "email": "weak@test.local",
            "username": "weakuser",
            "first_name": "W",
            "last_name": "K",
            "role": "student",
            "password": "short",
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 422


def test_student_cannot_edit_other_user(client, admin_token):
    # Create a student
    r = client.post(
        "/api/users/",
        json={
            "email": "stu@test.local",
            "username": "student1",
            "first_name": "S",
            "last_name": "T",
            "role": "student",
            "password": "studentpass1",
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 200, r.text
    student_id = r.json()["id"]

    login = client.post(
        "/api/auth/login",
        data={"username": "student1", "password": "studentpass1"},
    )
    stu = _auth(login.json()["access_token"])

    # Cannot edit the admin (id 1)
    assert client.put("/api/users/1", json={"is_active": False}, headers=stu).status_code == 403
    # Cannot change a privileged field on self
    assert client.put(f"/api/users/{student_id}", json={"is_active": False}, headers=stu).status_code == 403
    # Can change an allowed self field
    assert client.put(f"/api/users/{student_id}", json={"first_name": "New"}, headers=stu).status_code == 200


def test_meta_permissions_are_canonical(client):
    from app.crud.api_keys import AVAILABLE_PERMISSIONS

    r = client.get("/api/meta")
    assert r.status_code == 200
    assert set(r.json()["permissions"]) == set(AVAILABLE_PERMISSIONS)
