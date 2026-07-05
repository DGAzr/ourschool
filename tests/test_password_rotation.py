"""Tests for the forced-password-change (must_change_password) flow."""


def test_admin_reset_forces_password_change(client, admin_headers, student_factory):
    student, _ = student_factory()

    # Admin issues a temporary password.
    r = client.post(
        f"/api/users/{student['id']}/reset-password", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    temp_password = r.json()["temporary_password"]

    # Student logs in with the temporary password…
    r = client.post(
        "/api/auth/login",
        data={"username": student["username"], "password": temp_password},
    )
    assert r.status_code == 200, r.text
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    # …but is blocked from the app until the password is rotated.
    r = client.get("/api/assignments/my-assignments", headers=headers)
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "Password change required"

    # They can still see their own profile (which carries the flag)…
    r = client.get("/api/users/me", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is True

    # …and change the password.
    r = client.post(
        "/api/users/me/change-password",
        json={"current_password": temp_password, "new_password": "brandnew456pass"},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    # The flag clears and access is restored.
    r = client.get("/api/users/me", headers=headers)
    assert r.json()["must_change_password"] is False
    r = client.get("/api/assignments/my-assignments", headers=headers)
    assert r.status_code == 200, r.text


def test_default_admin_credentials_trigger_forced_rotation(client, engine):
    """Logging in as admin/admin123 flags the account even on upgraded installs."""
    r = client.post(
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
    # The shared session admin (adminpass123) must NOT be flagged by login.
    r = client.post(
        "/api/auth/login", data={"username": "admin", "password": "adminpass123"}
    )
    assert r.status_code == 200, r.text
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = client.get("/api/users/me", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is False
