"""Exercise browser-session authority, real student writes and PIN transitions."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

PIN = "012345"


def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def guided(client, admin_token, student_factory):
    student, student_headers = student_factory()
    second_device = client.post(
        "/api/auth/login", data={"username": "admin", "password": "adminpass123"}
    ).json()["access_token"]
    response = client.post(
        "/api/auth/switch-to-student",
        headers=headers(admin_token),
        json={"student_id": student["id"], "pin": PIN},
    )
    assert response.status_code == 200, response.text
    return student, response.json(), admin_token, second_device, student_headers


def test_switch_revokes_parent_and_preserves_independent_sessions(client, guided):
    student, result, old_parent, second_device, student_headers = guided
    token = result["access_token"]
    validated = client.get("/api/auth/session", headers=headers(token))
    assert validated.status_code == 200
    assert validated.headers["Cache-Control"] == "no-store"
    assert result["session"]["user"]["id"] == student["id"]
    assert result["session"]["is_guided"] is True
    assert result["session"]["return_account_name"] == "Ad Min"
    for endpoint in (
        "/api/users/me",
        "/api/users/students",
        "/api/assignments/my-assignments",
    ):
        assert client.get(endpoint, headers=headers(old_parent)).status_code == 401
    assert (
        client.post("/api/auth/extend-session", headers=headers(old_parent)).status_code
        == 401
    )
    assert client.get("/api/users/students", headers=headers(token)).status_code == 403
    assert (
        client.get("/api/users/students", headers=headers(second_device)).status_code
        == 200
    )
    assert client.get("/api/users/me", headers=student_headers).status_code == 200
    # A real student write is persisted and readable through a normal login.
    update = client.put(
        "/api/users/me", headers=headers(token), json={"first_name": "Guided"}
    )
    assert update.status_code == 200
    assert (
        client.get("/api/users/me", headers=student_headers).json()["first_name"]
        == "Guided"
    )
    assert (
        client.post(
            "/api/auth/switch-to-student",
            headers=headers(token),
            json={"student_id": student["id"], "pin": PIN},
        ).status_code
        == 403
    )


def test_return_rotates_credentials_and_erases_pin(client, guided, db_session):
    from app.core.security import decode_token
    from app.models.browser_session import BrowserSession

    _, result, old_parent, _, _ = guided
    token = result["access_token"]
    payload = decode_token(token)
    stored = db_session.get(BrowserSession, payload["sid"])
    assert stored.pin_hash != PIN and stored.pin_hash.startswith("$2")
    returned = client.post(
        "/api/auth/return-to-admin", headers=headers(token), json={"pin": PIN}
    )
    assert returned.status_code == 200, returned.text
    parent = returned.json()
    assert parent["session"]["user"]["role"] == "admin"
    assert parent["session"]["is_guided"] is False
    assert parent["session"]["generation"] == 2
    for stale in (token, old_parent):
        assert client.get("/api/users/me", headers=headers(stale)).status_code == 401
    assert (
        client.get(
            "/api/users/students", headers=headers(parent["access_token"])
        ).status_code
        == 200
    )
    db_session.expire_all()
    assert stored.pin_hash is None
    assert stored.pin_failures == 0


def test_pin_cooldown_shared_and_survives_renewal(client, guided, db_session):
    from app.core.security import decode_token
    from app.models.browser_session import BrowserSession

    _, result, _, _, _ = guided
    token = result["access_token"]
    for attempt in range(5):
        wrong = client.post(
            "/api/auth/return-to-admin", headers=headers(token), json={"pin": "999999"}
        )
        assert wrong.status_code == (429 if attempt == 4 else 403)
    assert wrong.headers["Retry-After"] == "300"
    renewed = client.post("/api/auth/extend-session", headers=headers(token))
    assert renewed.status_code == 200
    token = renewed.json()["access_token"]
    assert renewed.json()["session"]["is_guided"]
    blocked = client.post(
        "/api/auth/return-to-admin", headers=headers(token), json={"pin": PIN}
    )
    assert blocked.status_code == 429
    session = db_session.get(BrowserSession, decode_token(token)["sid"])
    session.pin_blocked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    assert (
        client.post(
            "/api/auth/return-to-admin", headers=headers(token), json={"pin": PIN}
        ).status_code
        == 200
    )


def test_concurrent_returns_only_one_succeeds(client, guided):
    _, result, _, _, _ = guided

    def attempt(_):
        return client.post(
            "/api/auth/return-to-admin",
            headers=headers(result["access_token"]),
            json={"pin": PIN},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, range(2))) == [200, 401]


def test_renewal_snapshot_stays_consistent_when_return_follows_commit(
    client, guided, db_session, monkeypatch
):
    from app.core.browser_sessions import issue_session_token
    from app.core.security import decode_token
    from app.models.browser_session import BrowserSession
    from app.models.user import User

    student, result, _, _, _ = guided
    credential = result["access_token"]
    session = db_session.get(BrowserSession, decode_token(credential)["sid"])
    learner = db_session.get(User, student["id"])
    commit = db_session.commit

    def commit_then_return():
        commit()
        # A second worker wins the next transaction immediately after renewal
        # releases its lock, before the renewal response has been constructed.
        returned = client.post(
            "/api/auth/return-to-admin",
            headers=headers(credential),
            json={"pin": PIN},
        )
        assert returned.status_code == 200, returned.text

    monkeypatch.setattr(db_session, "commit", commit_then_return)
    renewed = issue_session_token(db_session, session, learner)
    assert decode_token(renewed["access_token"])["gen"] == 1
    assert renewed["session"].generation == 1
    assert renewed["session"].is_guided
    assert renewed["session"].user.id == student["id"]
    assert (
        client.get(
            "/api/auth/session", headers=headers(renewed["access_token"])
        ).status_code
        == 401
    )


def test_concurrent_switches_only_one_succeeds(client, admin_token, student_factory):
    student, _ = student_factory()

    def attempt(_):
        return client.post(
            "/api/auth/switch-to-student",
            headers=headers(admin_token),
            json={"student_id": student["id"], "pin": PIN},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, range(2))) == [200, 401]


def test_normal_student_cannot_return_and_legacy_token_rejected(
    client, student_factory
):
    from app.core.security import create_access_token

    student, student_headers = student_factory()
    assert (
        client.post(
            "/api/auth/return-to-admin", headers=student_headers, json={"pin": PIN}
        ).status_code
        == 403
    )
    old_token = create_access_token({"sub": student["username"]})
    assert client.get("/api/users/me", headers=headers(old_token)).status_code == 401
    assert (
        client.get(
            "/api/assignments/my-assignments", headers=headers(old_token)
        ).status_code
        == 401
    )


@pytest.mark.parametrize("pin", ["1234", "1234567", "abcdef", "１２３４５６", 123456])
def test_invalid_pin_rejected(client, admin_token, student_factory, pin):
    student, _ = student_factory()
    response = client.post(
        "/api/auth/switch-to-student",
        headers=headers(admin_token),
        json={"student_id": student["id"], "pin": pin},
    )
    assert response.status_code == 422
    assert (
        client.get("/api/users/students", headers=headers(admin_token)).status_code
        == 200
    )


def test_temporary_password_only_bypassed_for_guided_use(
    client, admin_token, student_factory
):
    student, _ = student_factory()
    reset = client.post(
        f"/api/users/{student['id']}/reset-password", headers=headers(admin_token)
    )
    assert reset.status_code == 200
    login = client.post(
        "/api/auth/login",
        data={
            "username": student["username"],
            "password": reset.json()["temporary_password"],
        },
    ).json()
    normal = headers(login["access_token"])
    assert (
        client.get("/api/assignments/my-assignments", headers=normal).status_code == 403
    )
    switched = client.post(
        "/api/auth/switch-to-student",
        headers=headers(admin_token),
        json={"student_id": student["id"], "pin": PIN},
    ).json()
    guided_headers = headers(switched["access_token"])
    assert switched["session"]["user"]["must_change_password"]
    assert client.get("/api/users/me", headers=guided_headers).status_code == 200
    # Both dependency systems allow normal student endpoints during guided use.
    assert (
        client.get(
            "/api/assignments/my-assignments", headers=guided_headers
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/users/me/change-password",
            headers=guided_headers,
            json={
                "current_password": reset.json()["temporary_password"],
                "new_password": "newstudentpass123",
            },
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/return-to-admin", headers=guided_headers, json={"pin": PIN}
        ).status_code
        == 200
    )
    assert (
        client.get("/api/assignments/my-assignments", headers=normal).status_code == 403
    )


def test_logout_revokes_session_and_erases_pin(client, guided, db_session):
    from app.core.security import decode_token
    from app.models.browser_session import BrowserSession

    _, result, _, _, _ = guided
    token = result["access_token"]
    assert client.post("/api/auth/logout", headers=headers(token)).status_code == 204
    assert (
        client.post(
            "/api/auth/return-to-admin", headers=headers(token), json={"pin": PIN}
        ).status_code
        == 401
    )
    session = db_session.get(BrowserSession, decode_token(token)["sid"])
    assert session.revoked_at and session.pin_hash is None


@pytest.mark.parametrize("change", ["reset", "deactivate", "role", "delete"])
def test_student_account_changes_invalidate_guided_session(
    client, guided, db_session, change
):
    from app.models.user import User, UserRole

    student, result, _, administrator, _ = guided
    if change == "role":
        db_session.get(User, student["id"]).role = UserRole.ADMIN
        db_session.commit()
    elif change == "reset":
        assert (
            client.post(
                f"/api/users/{student['id']}/reset-password",
                headers=headers(administrator),
            ).status_code
            == 200
        )
    elif change == "deactivate":
        assert (
            client.put(
                f"/api/users/{student['id']}",
                headers=headers(administrator),
                json={"is_active": False},
            ).status_code
            == 200
        )
    else:
        assert (
            client.delete(
                f"/api/users/{student['id']}", headers=headers(administrator)
            ).status_code
            == 200
        )
    assert (
        client.get(
            "/api/auth/session", headers=headers(result["access_token"])
        ).status_code
        == 401
    )


def test_expiry_never_returns_parent(client, guided, db_session):
    from app.models.browser_session import BrowserSession
    from app.core.security import decode_token

    _, result, _, _, _ = guided
    token = result["access_token"]
    session = db_session.get(BrowserSession, decode_token(token)["sid"])
    session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    assert client.get("/api/auth/session", headers=headers(token)).status_code == 401
    assert (
        client.post(
            "/api/auth/return-to-admin", headers=headers(token), json={"pin": PIN}
        ).status_code
        == 401
    )


def test_backup_excludes_sessions_and_restore_revokes_them(client, guided):
    _, result, _, administrator, _ = guided
    response = client.get("/api/backup/export", headers=headers(administrator))
    assert response.status_code == 200
    backup = response.json()
    assert "browser_sessions" not in backup
    assert "pin_hash" not in response.text
    restored = client.post(
        "/api/backup/import",
        headers=headers(administrator),
        json={"backup_data": backup, "import_options": {}},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["success"], restored.text
    for token in (administrator, result["access_token"]):
        assert (
            client.get("/api/auth/session", headers=headers(token)).status_code == 401
        )


def test_guided_student_submits_real_work_and_json_backup_preserves_it(
    client, classroom, guided, db_session
):
    from datetime import date
    from app.models.assignment import StudentAssignment

    student, result, _, administrator, _ = guided
    assignment = StudentAssignment(
        student_id=student["id"],
        template_id=classroom["template"]["id"],
        assigned_date=date.today(),
    )
    db_session.add(assignment)
    db_session.commit()
    url = f"/api/assignments/student-assignments/{assignment.id}"
    response = client.put(
        url,
        headers=headers(result["access_token"]),
        json={
            "status": "submitted",
            "submission_method": "paper",
            "submission_notes": "My work is on the table.",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["student_id"] == student["id"]
    backup = client.get("/api/backup/export", headers=headers(administrator)).json()
    archived = next(
        row
        for row in backup["student_assignments"]
        if row["student_email"] == student["email"]
    )
    assert archived["submission_method"] == "paper"
    assert archived["submission_notes"] == "My work is on the table."


def test_switch_accepts_unassigned_students_and_rejects_inactive_targets(
    client, admin_token, student_factory, db_session
):
    from app.models.user import User

    student, _ = student_factory()
    target = db_session.get(User, student["id"])
    target.parent_id = None
    target.student_ui_mode = "simple"
    db_session.commit()
    response = client.post(
        "/api/auth/switch-to-student",
        headers=headers(admin_token),
        json={"student_id": student["id"], "pin": PIN},
    )
    assert response.status_code == 200
    assert response.json()["session"]["user"]["student_ui_mode"] == "simple"
    returned = client.post(
        "/api/auth/return-to-admin",
        headers=headers(response.json()["access_token"]),
        json={"pin": PIN},
    ).json()
    target.is_active = False
    db_session.commit()
    assert (
        client.post(
            "/api/auth/switch-to-student",
            headers=headers(returned["access_token"]),
            json={"student_id": student["id"], "pin": PIN},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/auth/switch-to-student",
            headers=headers(returned["access_token"]),
            json={"student_id": 1, "pin": PIN},
        ).status_code
        == 404
    )


def test_api_keys_cannot_control_browser_switches(client, admin_token, student_factory):
    student, _ = student_factory()
    key = client.post(
        "/api/admin/api-keys/",
        headers=headers(admin_token),
        json={"name": "Browser switch test", "permissions": ["students:read"]},
    )
    assert key.status_code == 200, key.text
    api_headers = {"X-API-Key": key.json()["api_key"]}
    assert client.get("/api/users/students", headers=api_headers).status_code == 200
    assert (
        client.post(
            "/api/auth/switch-to-student",
            headers=api_headers,
            json={"student_id": student["id"], "pin": PIN},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/return-to-admin", headers=api_headers, json={"pin": PIN}
        ).status_code
        == 401
    )


def test_nonexpiring_guided_session_stays_restricted_and_password_change_revokes(
    client, admin_token, student_factory
):
    from app.core.security import decode_token

    student, student_headers = student_factory()
    administrator = headers(admin_token)
    try:
        assert (
            client.put(
                "/api/settings/security/session-timeout",
                headers=administrator,
                json={"session_timeout_minutes": 0},
            ).status_code
            == 200
        )
        switched = client.post(
            "/api/auth/switch-to-student",
            headers=administrator,
            json={"student_id": student["id"], "pin": PIN},
        ).json()
        assert "exp" not in decode_token(switched["access_token"])
        assert switched["session"]["expires_at"] is None
        assert (
            client.get(
                "/api/users/students", headers=headers(switched["access_token"])
            ).status_code
            == 403
        )
        restored = client.post(
            "/api/auth/return-to-admin",
            headers=headers(switched["access_token"]),
            json={"pin": PIN},
        ).json()
        administrator = headers(restored["access_token"])
        changed = client.post(
            "/api/users/me/change-password",
            headers=student_headers,
            json={
                "current_password": "studentpass123",
                "new_password": "newstudentpass123",
            },
        )
        assert changed.status_code == 200
        assert (
            client.get("/api/auth/session", headers=student_headers).status_code == 401
        )
    finally:
        client.put(
            "/api/settings/security/session-timeout",
            headers=administrator,
            json={"session_timeout_minutes": 30},
        )
