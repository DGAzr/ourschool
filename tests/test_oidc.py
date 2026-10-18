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
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

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
            data = {"keys": [public]}
        elif path == "/userinfo":
            data = state["userinfo"]
        elif path == "/token":
            state["posts"].append(parse_qs(request.content.decode()))
            claims = {
                "iss": "https://id.example",
                "aud": "school",
                "sub": state["subject"],
                "iat": int(time.time()),
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
                    claims, state["key"], algorithm="RS256", headers={"kid": "test"}
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


def test_password_change_requirement_cleared(client, provider, db_session):
    provider["user"].must_change_password = True
    db_session.commit()
    response = finish(client, begin(client, provider))
    assert response.status_code == 200
    assert not response.json()["session"]["user"]["must_change_password"]
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    assert client.get("/api/auth/session", headers=headers).status_code == 200
    assert client.get("/api/users/", headers=headers).status_code == 200


def test_userinfo_verified_email(client, provider):
    provider["discovery"] = {"userinfo_endpoint": "https://id.example/userinfo"}
    provider["omit_claims"] = ["email_verified"]
    provider["userinfo"] = {"sub": provider["subject"], "email_verified": True}
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


@pytest.mark.parametrize("duplicate", [False, True])
def test_invalid_kid(client, provider, monkeypatch, duplicate):
    public = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(provider["key"].public_key())
    )
    public["kid"] = "test"

    async def keys(*args, **kwargs):
        return {
            "keys": (
                [public, public]
                if duplicate
                else [{k: v for k, v in public.items() if k != "kid"}]
            )
        }

    monkeypatch.setattr(oidc, "get_json", keys)
    token = jwt.encode(
        {},
        provider["key"],
        algorithm="RS256",
        headers={"kid": "test"} if duplicate else {},
    )
    with pytest.raises(oidc.OIDCError):
        asyncio.run(
            oidc.verified_claims(
                {"jwks_uri": "https://id.example/jwks"}, token, "nonce"
            )
        )


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
