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


def test_configurable_session_timeout(client, admin_token):
    from app.core.security import decode_token

    headers = _auth(admin_token)
    try:
        update = client.put(
            "/api/settings/security/session-timeout",
            json={"session_timeout_minutes": 60},
            headers=headers,
        )
        assert update.status_code == 200, update.text

        login = client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "adminpass123"},
        )
        assert login.status_code == 200, login.text
        finite_token = login.json()["access_token"]
        finite_payload = decode_token(finite_token)
        assert finite_payload["exp"] - finite_payload["iat"] == 60 * 60

        update = client.put(
            "/api/settings/security/session-timeout",
            json={"session_timeout_minutes": 0},
            headers=headers,
        )
        assert update.status_code == 200, update.text

        extension = client.post(
            "/api/auth/extend-session",
            headers=_auth(finite_token),
        )
        assert extension.status_code == 200, extension.text
        non_expiring_token = extension.json()["access_token"]
        assert "exp" not in decode_token(non_expiring_token)

        grouped = client.get(
            "/api/settings/grouped", headers=_auth(non_expiring_token)
        )
        assert grouped.status_code == 200, grouped.text
        assert grouped.json()["security"]["session_timeout_minutes"] == 0
    finally:
        client.put(
            "/api/settings/security/session-timeout",
            json={"session_timeout_minutes": 30},
            headers=headers,
        )


def test_session_timeout_rejects_negative_minutes(client, admin_token):
    response = client.put(
        "/api/settings/security/session-timeout",
        json={"session_timeout_minutes": -1},
        headers=_auth(admin_token),
    )
    assert response.status_code == 422


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


def test_theme_preference_self_service(client, student_factory):
    _student, headers = student_factory()

    # Defaults to null until the user picks one
    me = client.get("/api/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["theme_preference"] is None

    r = client.put(
        "/api/users/me", json={"theme_preference": "dark"}, headers=headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["theme_preference"] == "dark"

    # Persisted across reads
    me = client.get("/api/users/me", headers=headers)
    assert me.json()["theme_preference"] == "dark"

    # Invalid values are rejected by schema validation
    r = client.put(
        "/api/users/me", json={"theme_preference": "purple"}, headers=headers
    )
    assert r.status_code == 422

    # Privileged fields are still off-limits via /users/me
    r = client.put("/api/users/me", json={"is_active": False}, headers=headers)
    assert r.status_code == 403


def test_meta_permissions_are_canonical(client):
    from app.crud.api_keys import AVAILABLE_PERMISSIONS

    r = client.get("/api/meta")
    assert r.status_code == 200
    assert set(r.json()["permissions"]) == set(AVAILABLE_PERMISSIONS)
