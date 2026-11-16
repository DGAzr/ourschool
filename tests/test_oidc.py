# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""OIDC provider and login tests; no external network requests."""

import asyncio
import base64
import hashlib
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import User, UserRole
from app.routers import oidc, auth


@pytest.fixture()
def provider(monkeypatch, db_session, admin_token):
    oidc._provider_cache.clear()
    auth._login_failures.clear()
    for key, value in {
        "oidc_enabled": True,
        "oidc_issuer_url": "https://id.example",
        "oidc_client_id": "school",
        "oidc_client_secret": None,
        "oidc_redirect_uri": "http://localhost/auth/oidc/callback",
        "oidc_auto_provision": False,
        "oidc_user_match_claim": "email",
        "oidc_allow_unverified_email": False,
        "oidc_allow_admin_linking": False,
        "oidc_disable_local_login": False,
    }.items():
        monkeypatch.setattr(settings, key, value)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    public["kid"] = "test"
    suffix = uuid.uuid4().hex
    user = User(
        username="oidc-" + suffix,
        email=suffix + "@example.com",
        first_name="Test",
        last_name="User",
        hashed_password="!",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    state = {"key": key, "user": user, "claims": {}, "posts": [], "subject": suffix}

    async def send(client, request, **kwargs):
        path = request.url.path
        if path == "/.well-known/openid-configuration":
            data = {
                "issuer": settings.oidc_issuer_url,
                "authorization_endpoint": "https://id.example/authorize",
                "token_endpoint": "https://id.example/token",
                "jwks_uri": "https://id.example/jwks",
            }
            data.update(state.get("discovery", {}))
        elif path == "/jwks":
            state["jwks_calls"] = state.get("jwks_calls", 0) + 1
            data = {"keys": state.get("jwks", [public])}
        elif path == "/userinfo":
            state["userinfo_calls"] = state.get("userinfo_calls", 0) + 1
            data = state["userinfo"]
        elif path == "/token":
            state["posts"].append(parse_qs(request.content.decode()))
            claims = {
                "iss": "https://id.example",
                "aud": "school",
                "sub": state["subject"],
                "iat": int(time.time()),
                "auth_time": int(time.time()),
                "exp": int(time.time()) + 300,
                "nonce": state["nonce"],
                "email": user.email.upper(),
                "email_verified": True,
                "preferred_username": user.username.upper(),
            }
            claims.update(state["claims"])
            for name in state.get("omit_claims", []):
                claims.pop(name, None)
            data = {
                "access_token": "provider-access-token",
                "id_token": jwt.encode(
                    claims,
                    state["key"],
                    algorithm="RS256",
                    headers=state.get("headers", {"kid": "test"}),
                ),
            }
        else:
            raise AssertionError(f"Unexpected provider request: {path}")
        return httpx.Response(200, json=data, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "send", send)
    return state


def begin(client, provider):
    response = client.get("/api/auth/oidc/start")
    assert response.status_code == 200, response.text
    query = parse_qs(urlsplit(response.json()["authorization_url"]).query)
    provider["nonce"] = query["nonce"][0]
    return query


def finish(client, query):
    return client.post(
        "/api/auth/oidc/callback",
        json={"code": "test-code", "state": query["state"][0]},
    )


def wait_for_database_lock(db, pid):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        db.execute(text("SELECT pg_stat_clear_snapshot()"))
        waiting = db.scalar(
            text(
                "SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = :pid"
            ),
            {"pid": pid},
        )
        if waiting:
            return
        time.sleep(0.01)
    pytest.fail("Competing login did not wait for the first transaction's lock")


def test_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "oidc_enabled", False)
    monkeypatch.setattr(settings, "oidc_disable_local_login", True)
    assert client.get("/api/auth/oidc/config").json() == {
        "enabled": False,
        "button_label": "Sign in with SSO",
        "local_login_enabled": True,
    }
    assert client.get("/api/auth/oidc/start").status_code == 404
    assert finish(client, {"state": ["bad"]}).status_code == 404
    assert (
        client.post(
            "/api/auth/login", data={"username": "absent", "password": "bad"}
        ).status_code
        == 401
    )


def test_missing_config(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_client_id", "")
    assert client.get("/api/auth/oidc/start").status_code == 503
    assert finish(client, {"state": ["bad"]}).status_code == 503


def test_start_and_login(client, provider):
    query = begin(client, provider)
    assert query["code_challenge_method"] == ["S256"]
    assert query["max_age"] == ["0"]
    cookie = client.cookies.get(oidc._COOKIE)
    transaction = jwt.decode(
        cookie, settings.secret_key, algorithms=["HS256"], audience="school"
    )
    assert (
        query["code_challenge"][0]
        == base64.urlsafe_b64encode(
            hashlib.sha256(transaction["verifier"].encode()).digest()
        )
        .rstrip(b"=")
        .decode()
    )
    response = finish(client, query)
    assert response.status_code == 200, response.text
    assert response.json()["session"]["user"]["id"] == provider["user"].id
    assert provider["posts"][0]["code_verifier"] == [transaction["verifier"]]
    assert oidc._COOKIE not in client.cookies
    assert (
        client.get(
            "/api/auth/session",
            headers={"Authorization": "Bearer " + response.json()["access_token"]},
        ).status_code
        == 200
    )


def test_username_match(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_user_match_claim", "preferred_username")
    provider["claims"] = {"email_verified": False}
    assert finish(client, begin(client, provider)).status_code == 200


@pytest.mark.parametrize(
    "claims",
    [
        {"nonce": "wrong"},
        {"aud": "wrong"},
        {"iss": "https://wrong.example"},
        {"email_verified": False},
        {"email_verified": "true"},
        {"email": "unknown@example.com"},
        {"exp": 1},
        {"iat": int(time.time()) + 600},
        {"aud": ["school", "other"]},
        {"azp": "other"},
    ],
)
def test_invalid_claims(client, provider, claims):
    provider["claims"] = claims
    response = finish(client, begin(client, provider))
    assert response.status_code == 401
    assert oidc._COOKIE not in client.cookies


def test_bad_signature(client, provider):
    provider["key"] = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert finish(client, begin(client, provider)).status_code == 401


@pytest.mark.parametrize("missing", [False, True])
def test_state(client, provider, missing):
    query = begin(client, provider)
    if missing:
        client.cookies.clear()
    else:
        query["state"] = ["wrong"]
    assert finish(client, query).status_code == 401
    assert not provider["posts"]


def test_inactive(client, provider, db_session):
    provider["user"].is_active = False
    db_session.commit()
    assert finish(client, begin(client, provider)).status_code == 401


def test_provision(client, provider, monkeypatch, db_session):
    monkeypatch.setattr(settings, "oidc_auto_provision", True)
    suffix = uuid.uuid4().hex
    provider["claims"] = {
        "email": suffix + "@example.com",
        "preferred_username": suffix,
    }
    response = finish(client, begin(client, provider))
    assert response.status_code == 200, response.text
    user = db_session.query(User).filter(User.username == suffix).one()
    assert user.role == UserRole.STUDENT
    assert user.is_active and not user.must_change_password


def test_collision(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_auto_provision", True)
    provider["claims"] = {"email": "other@example.com"}
    assert finish(client, begin(client, provider)).status_code == 401


def test_disable_password(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_disable_local_login", True)
    assert not client.get("/api/auth/oidc/config").json()["local_login_enabled"]
    assert (
        client.post(
            "/api/auth/login", data={"username": "x", "password": "y"}
        ).status_code
        == 403
    )


def test_discovery_mismatch(client, provider):
    provider["discovery"] = {"issuer": "https://wrong.example"}
    assert client.get("/api/auth/oidc/start").status_code == 503


def test_jwks_rotation(client, provider):
    oidc._provider_cache["https://id.example/jwks"] = (
        time.monotonic() + 300,
        {"keys": []},
    )
    assert finish(client, begin(client, provider)).status_code == 200
    assert provider["jwks_calls"] == 1


@pytest.mark.parametrize("subject", ["subject", "different-subject"])
def test_userinfo(client, provider, subject):
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["email", "email_verified"]
    provider["userinfo"] = {
        "sub": provider["subject"] if subject == "subject" else subject,
        "email": provider["user"].email,
        "email_verified": True,
    }
    response = finish(client, begin(client, provider))
    assert response.status_code == (200 if subject == "subject" else 401)


@pytest.mark.parametrize("method", ["client_secret_basic", "client_secret_post"])
def test_confidential_client(client, provider, monkeypatch, method):
    monkeypatch.setattr(settings, "oidc_client_secret", "test-only-client-secret")
    provider["discovery"] = {"token_endpoint_auth_methods_supported": [method]}
    assert finish(client, begin(client, provider)).status_code == 200
    assert ("client_secret" in provider["posts"][0]) == (method == "client_secret_post")


def test_secure_cookie(client, provider, monkeypatch):
    monkeypatch.setattr(
        settings, "oidc_redirect_uri", "https://school.example/auth/oidc/callback"
    )
    response = client.get("/api/auth/oidc/start")
    cookie = response.headers["set-cookie"]
    for value in (
        "HttpOnly",
        "Secure",
        "SameSite=lax",
        "Path=/api/auth/oidc",
        "Max-Age=600",
    ):
        assert value in cookie


def test_expired_cookie(client, provider):
    query = begin(client, provider)
    transaction = jwt.decode(
        client.cookies.get(oidc._COOKIE),
        settings.secret_key,
        algorithms=["HS256"],
        audience="school",
    )
    transaction["exp"] = 1
    client.cookies.clear()
    client.cookies.set(
        oidc._COOKIE,
        jwt.encode(transaction, settings.secret_key, algorithm="HS256"),
        path=oidc._COOKIE_PATH,
    )
    assert finish(client, query).status_code == 401
    assert not provider["posts"]


def test_unverified_override(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_allow_unverified_email", True)
    provider["claims"] = {"email_verified": False}
    assert finish(client, begin(client, provider)).status_code == 200


def test_sso_invalidates_temporary_password_and_existing_sessions(
    client, provider, db_session
):
    from app.core.security import get_password_hash, verify_password

    user = provider["user"]
    password = "temporary-oidc-password"
    user.hashed_password = get_password_hash(password)
    user.must_change_password = True
    db_session.commit()
    local = client.post(
        "/api/auth/login", data={"username": user.username, "password": password}
    )
    assert local.status_code == 200
    assert local.json()["session"]["user"]["must_change_password"]
    response = finish(client, begin(client, provider))
    assert response.status_code == 200
    assert not response.json()["session"]["user"]["must_change_password"]
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    assert client.get("/api/auth/session", headers=headers).status_code == 200
    assert client.get("/api/users/", headers=headers).status_code == 200
    db_session.refresh(user)
    assert not verify_password(password, user.hashed_password)
    assert (
        client.post(
            "/api/auth/login", data={"username": user.username, "password": password}
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/auth/session",
            headers={"Authorization": "Bearer " + local.json()["access_token"]},
        ).status_code
        == 401
    )


def test_sso_preserves_regular_local_password(client, provider, db_session):
    from app.core.security import get_password_hash

    user = provider["user"]
    user.hashed_password = get_password_hash("regular-oidc-password")
    db_session.commit()
    password_hash = user.hashed_password
    assert finish(client, begin(client, provider)).status_code == 200
    db_session.refresh(user)
    assert user.hashed_password == password_hash
    assert (
        client.post(
            "/api/auth/login",
            data={"username": user.username, "password": "regular-oidc-password"},
        ).status_code
        == 200
    )


def test_userinfo_verified_email(client, provider):
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["email_verified"]
    provider["userinfo"] = {
        "sub": provider["subject"],
        "email": provider["user"].email,
        "email_verified": True,
    }
    assert finish(client, begin(client, provider)).status_code == 200


@pytest.mark.parametrize("missing", ["sub", "nonce"])
def test_missing_identity_claim(client, provider, missing):
    provider["omit_claims"] = [missing]
    assert finish(client, begin(client, provider)).status_code == 401


@pytest.mark.parametrize("algorithm", ["none", "HS256", "RS384"])
def test_rejected_algorithm(client, provider, monkeypatch, algorithm):
    async def invalid_keys(*args, **kwargs):
        raise AssertionError("Rejected algorithms must not fetch keys")

    monkeypatch.setattr(oidc, "get_json", invalid_keys)
    token = (
        jwt.encode(
            {},
            "" if algorithm == "none" else "x" * 32,
            algorithm=algorithm,
            headers={"kid": "test"},
        )
        if algorithm != "RS384"
        else jwt.encode({}, provider["key"], algorithm="RS384", headers={"kid": "test"})
    )
    with pytest.raises(
        oidc.OIDCError,
        match=(
            "Unadvertised signing algorithm"
            if algorithm == "RS384"
            else "Unsupported signing algorithm"
        ),
    ):
        asyncio.run(oidc.verified_claims({}, token, "nonce"))


@pytest.mark.parametrize("kid", [None, "test"])
def test_ambiguous_signing_keys_rejected(client, provider, kid):
    public = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(provider["key"].public_key())
    )
    public["kid"] = "test"

    provider["jwks"] = [public, public]
    provider["headers"] = {} if kid is None else {"kid": kid}
    assert finish(client, begin(client, provider)).status_code == 401


@pytest.mark.parametrize("key_has_kid", [False, True])
def test_single_signing_key_without_token_kid(client, provider, key_has_kid):
    public = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(provider["key"].public_key())
    )
    if key_has_kid:
        public["kid"] = "test"
    provider["jwks"] = [public]
    provider["headers"] = {}
    assert finish(client, begin(client, provider)).status_code == 200


def test_explicit_unknown_kid_does_not_fall_back_to_single_key(client, provider):
    provider["headers"] = {"kid": "unknown"}
    assert finish(client, begin(client, provider)).status_code == 401


@pytest.mark.parametrize("key_ops", [["encrypt"], ["sign"]])
def test_signing_key_must_allow_verification(client, provider, key_ops):
    public = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(provider["key"].public_key())
    )
    public.update(kid="test", key_ops=key_ops)
    provider["jwks"] = [public]
    assert finish(client, begin(client, provider)).status_code == 401


def test_tampered_cookie(client, provider):
    query = begin(client, provider)
    cookie = client.cookies.get(oidc._COOKIE)
    client.cookies.clear()
    client.cookies.set(oidc._COOKIE, "x" + cookie[1:], path=oidc._COOKIE_PATH)
    assert finish(client, query).status_code == 401
    assert not provider["posts"]


def test_unsupported_client_auth(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_client_secret", "secret")
    provider["discovery"] = {
        "token_endpoint_auth_methods_supported": ["private_key_jwt"]
    }
    assert finish(client, begin(client, provider)).status_code == 401


def test_http_discovery_refused(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_issuer_url", "http://id.example")
    assert client.get("/api/auth/oidc/start").status_code == 503


def test_redirect_uri_required(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_redirect_uri", None)
    assert client.get("/api/auth/oidc/start").status_code == 503
    assert finish(client, {"state": ["bad"]}).status_code == 503


@pytest.mark.parametrize("allowed", [False, True])
def test_admin_linking(client, provider, db_session, monkeypatch, allowed):
    provider["user"].role = UserRole.ADMIN
    db_session.commit()
    monkeypatch.setattr(settings, "oidc_allow_admin_linking", allowed)
    assert finish(client, begin(client, provider)).status_code == (
        200 if allowed else 401
    )
    if allowed:
        monkeypatch.setattr(settings, "oidc_allow_admin_linking", False)
        assert finish(client, begin(client, provider)).status_code == 200


def test_subject_binding(client, provider, db_session):
    assert finish(client, begin(client, provider)).status_code == 200
    db_session.refresh(provider["user"])
    assert provider["user"].oidc_subject == provider["subject"]
    provider["claims"] = {"sub": "attacker"}
    assert finish(client, begin(client, provider)).status_code == 401
    provider["claims"] = {"email": "changed@example.com"}
    response = finish(client, begin(client, provider))
    assert response.status_code == 200
    assert response.json()["session"]["user"]["id"] == provider["user"].id


@pytest.mark.parametrize("same_identity", [False, True])
def test_concurrent_first_links_are_serialized(
    provider, engine, db_session, same_identity
):
    """The second callback must re-read the winning link, even with a stale ORM row."""
    from app.core.browser_sessions import resolve_browser_session
    from app.models.browser_session import BrowserSession

    Sessions = sessionmaker(bind=engine)
    user_id = provider["user"].id
    claims = {
        "iss": settings.oidc_issuer_url,
        "sub": provider["subject"],
        "email": provider["user"].email,
        "email_verified": True,
    }
    ready, start = Event(), Event()
    backend = {}

    def second_callback():
        with Sessions() as second:
            # Keep a strong reference to exercise populate_existing after the wait.
            cached_user = second.get(User, user_id)
            assert cached_user.oidc_subject is None
            backend["pid"] = second.scalar(text("SELECT pg_backend_pid()"))
            ready.set()
            assert start.wait(5)
            try:
                user = oidc.match_user(
                    second,
                    {
                        **claims,
                        "sub": (
                            claims["sub"] if same_identity else "other-" + claims["sub"]
                        ),
                    },
                )
                return auth.create_login_session(second, user)["access_token"]
            except oidc.OIDCError as exc:
                second.rollback()
                assert str(exc) == "Account already linked to another identity"
                return None

    with ThreadPoolExecutor(max_workers=1) as pool, Sessions() as first:
        future = pool.submit(second_callback)
        try:
            assert ready.wait(5)
            winner = oidc.match_user(first, claims)
            start.set()
            wait_for_database_lock(db_session, backend["pid"])
            token = auth.create_login_session(first, winner)["access_token"]
        finally:
            start.set()
            first.rollback()
        other_token = future.result(timeout=5)
    assert bool(other_token) is same_identity
    assert resolve_browser_session(token, db_session)[1].id == user_id
    if other_token:
        assert resolve_browser_session(other_token, db_session)[1].id == user_id
    db_session.refresh(provider["user"])
    assert provider["user"].oidc_subject == claims["sub"]
    assert db_session.query(BrowserSession).filter_by(
        original_user_id=user_id
    ).count() == (2 if same_identity else 1)


def test_temporary_password_login_cannot_race_sso_invalidation(
    client, provider, engine, db_session, monkeypatch
):
    user = provider["user"]
    password = "temporary-racing-password"
    real_hash = oidc.get_password_hash
    user.hashed_password = real_hash(password)
    user.must_change_password = True
    db_session.commit()
    user_id, username = user.id, user.username
    query = begin(client, provider)
    locked, release, ready = Event(), Event(), Event()
    backend = {}
    Sessions = sessionmaker(bind=engine)

    def pause_invalidation(secret):
        locked.set()
        assert release.wait(5)
        return real_hash(secret)

    def competing_password_login():
        with Sessions() as local:
            cached_user = local.get(User, user_id)
            assert cached_user.must_change_password
            backend["pid"] = local.scalar(text("SELECT pg_backend_pid()"))
            ready.set()
            authenticated = auth.authenticate_user(local, username, password)
            if authenticated:
                return auth.create_login_session(local, authenticated)["access_token"]
            return None

    monkeypatch.setattr(oidc, "get_password_hash", pause_invalidation)
    with ThreadPoolExecutor(max_workers=2) as pool:
        sso = pool.submit(finish, client, query)
        try:
            assert locked.wait(5)
            local = pool.submit(competing_password_login)
            assert ready.wait(5)
            wait_for_database_lock(db_session, backend["pid"])
        finally:
            release.set()
        result = sso.result(timeout=5)
        assert result.status_code == 200, result.text
        assert local.result(timeout=5) is None


@pytest.mark.parametrize(
    "freshness", ["missing", "old", "future", "string", "bool", "nan"]
)
def test_stale_admin_sso_cannot_escape_guided_student_session(
    client, provider, db_session, freshness
):
    from app.core.security import decode_token

    administrator = provider["user"]
    administrator.role = UserRole.ADMIN
    administrator.oidc_issuer = settings.oidc_issuer_url
    administrator.oidc_subject = provider["subject"]
    student = User(
        username="guided-oidc-" + uuid.uuid4().hex,
        email=uuid.uuid4().hex + "@example.com",
        first_name="Guided",
        last_name="Student",
        hashed_password="!",
        role=UserRole.STUDENT,
    )
    db_session.add(student)
    db_session.commit()
    parent = auth.create_login_session(db_session, administrator)
    guided = client.post(
        "/api/auth/switch-to-student",
        headers={"Authorization": "Bearer " + parent["access_token"]},
        json={"student_id": student.id, "pin": "123456"},
    )
    assert guided.status_code == 200
    assert guided.json()["session"]["is_guided"]
    if freshness == "missing":
        provider["omit_claims"] = ["auth_time"]
    else:
        provider["claims"]["auth_time"] = {
            "old": int(time.time()) - 3600,
            "future": int(time.time()) + 600,
            "string": str(int(time.time())),
            "bool": True,
            "nan": float("nan"),
        }[freshness]
    query = begin(client, provider)
    assert query["max_age"] == ["0"]
    assert finish(client, query).status_code == 401
    headers = {"Authorization": "Bearer " + guided.json()["access_token"]}
    assert client.get("/api/auth/session", headers=headers).json()["is_guided"]
    assert client.get("/api/users/students", headers=headers).status_code == 403
    # Fresh authentication can recover parent authority without the old PIN.
    provider["omit_claims"] = []
    provider["claims"].pop("auth_time", None)
    recovered = finish(client, begin(client, provider))
    assert recovered.status_code == 200
    assert recovered.json()["session"]["user"]["role"] == "admin"
    assert not recovered.json()["session"]["is_guided"]
    assert (
        decode_token(recovered.json()["access_token"])["sid"]
        != decode_token(guided.json()["access_token"])["sid"]
    )


def test_userinfo_cannot_supply_admin_authentication_time(
    client, provider, db_session, monkeypatch
):
    provider["user"].role = UserRole.ADMIN
    db_session.commit()
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["auth_time", "email_verified"]
    provider["userinfo"] = {
        "sub": provider["subject"],
        "email": provider["user"].email,
        "email_verified": True,
        "auth_time": int(time.time()),
    }
    # A successful first link must not persist when freshness validation fails.
    monkeypatch.setattr(settings, "oidc_allow_admin_linking", True)
    assert finish(client, begin(client, provider)).status_code == 401
    db_session.refresh(provider["user"])
    assert provider["user"].oidc_subject is None


@pytest.mark.parametrize("extra_email", [None, "different@example.com"])
def test_userinfo_verification_must_name_the_same_email(client, provider, extra_email):
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["email_verified"]
    provider["userinfo"] = {"sub": provider["subject"], "email_verified": True}
    if extra_email:
        provider["userinfo"]["email"] = extra_email
    assert finish(client, begin(client, provider)).status_code == 401


def test_id_token_verification_cannot_verify_userinfo_email(client, provider):
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["email"]
    provider["userinfo"] = {
        "sub": provider["subject"],
        "email": provider["user"].email,
        "email_verified": False,
    }
    assert finish(client, begin(client, provider)).status_code == 401


def test_userinfo_cannot_override_explicit_unverified_email():
    claims = {"sub": "subject", "email": "user@example.com", "email_verified": False}
    extra = {**claims, "email_verified": True}
    assert oidc.merge_userinfo(claims, extra)["email_verified"] is False


def test_userinfo_does_not_equate_distinct_unicode_email_addresses():
    claims = {"sub": "subject", "email": "straße@example.com"}
    extra = {"sub": "subject", "email": "strasse@example.com", "email_verified": True}
    with pytest.raises(oidc.OIDCError, match="Userinfo email mismatch"):
        oidc.merge_userinfo(claims, extra)


def test_bound_identity_does_not_require_userinfo(client, provider, monkeypatch):
    assert finish(client, begin(client, provider)).status_code == 200
    monkeypatch.setattr(settings, "oidc_auto_provision", True)
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["email", "email_verified", "preferred_username"]
    assert finish(client, begin(client, provider)).status_code == 200
    assert not provider.get("userinfo_calls")


def test_username_provision_fetches_userinfo_email(
    client, provider, monkeypatch, db_session
):
    monkeypatch.setattr(settings, "oidc_auto_provision", True)
    monkeypatch.setattr(settings, "oidc_user_match_claim", "preferred_username")
    username = uuid.uuid4().hex
    provider["claims"] = {"preferred_username": username}
    provider["omit_claims"] = ["email", "email_verified"]
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["userinfo"] = {
        "sub": provider["subject"],
        "email": username + "@example.com",
        "email_verified": True,
    }
    response = finish(client, begin(client, provider))
    assert response.status_code == 200, response.text
    assert provider["userinfo_calls"] == 1
    user = db_session.query(User).filter_by(username=username).one()
    assert user.role == UserRole.STUDENT
    assert user.email == provider["userinfo"]["email"]


def test_junk_callbacks_do_not_lock_out_login(client, provider):
    query = begin(client, provider)
    for _ in range(20):
        assert finish(client, {"state": ["wrong"]}).status_code == 401
    assert not auth._login_failures
    assert finish(client, begin(client, provider)).status_code == 200


def test_username_provision_requires_verified_email(client, provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_user_match_claim", "preferred_username")
    monkeypatch.setattr(settings, "oidc_auto_provision", True)
    provider["claims"] = {
        "email": "new@example.com",
        "preferred_username": "new-user",
        "email_verified": False,
    }
    assert finish(client, begin(client, provider)).status_code == 401


def test_ambiguous_match(client, provider, db_session):
    user = provider["user"]
    db_session.add(
        User(
            email=user.email.upper(),
            username=uuid.uuid4().hex,
            first_name="Other",
            last_name="User",
            hashed_password="!",
            role=UserRole.STUDENT,
        )
    )
    db_session.commit()
    assert finish(client, begin(client, provider)).status_code == 401


@pytest.mark.parametrize(
    "field", ["email", "preferred_username", "given_name", "family_name"]
)
def test_provision_claim_limits(client, provider, monkeypatch, field):
    monkeypatch.setattr(settings, "oidc_auto_provision", True)
    provider["claims"] = {
        "email": "new@example.com",
        "preferred_username": "new-user",
        field: "x" * 256,
    }
    assert finish(client, begin(client, provider)).status_code == 401


def test_oversized_id_token(provider):
    with pytest.raises(oidc.OIDCError, match="size"):
        asyncio.run(oidc.verified_claims({}, "x" * 16385, "nonce"))


@pytest.mark.parametrize("status,body", [(302, b""), (200, b"x" * (1024 * 1024 + 1))])
def test_provider_response_limits(status, body):
    async def check():
        transport = httpx.MockTransport(
            lambda request: httpx.Response(
                status, content=body, headers={"location": "https://other.example"}
            )
        )
        async with httpx.AsyncClient(
            transport=transport, follow_redirects=False
        ) as client:
            with pytest.raises((oidc.OIDCError, httpx.HTTPStatusError)):
                await oidc.read_provider_json(
                    client, "GET", "https://id.example/discovery"
                )

    asyncio.run(check())
