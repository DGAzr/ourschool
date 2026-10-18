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

"""Optional stateless OpenID Connect authorization-code login."""

import base64
import hashlib
import json
import secrets
import time
from typing import Annotated, Any
from urllib.parse import quote_plus, urlencode, urlsplit

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger, log_authentication_event
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.user import Token
from app.routers.auth import create_login_session

router = APIRouter()
logger = get_logger("oidc")
_COOKIE = "ourschool_oidc"
_COOKIE_PATH = "/api/auth/oidc"
_TRANSACTION_TTL = 600
_provider_cache: dict = {}


class OIDCError(ValueError):
    """A safe diagnostic that never contains provider credentials."""


class Callback(BaseModel):
    code: str = Field(min_length=1, max_length=8192)
    state: str = Field(min_length=1, max_length=1024)


def authentication_diagnostic(exc: Exception) -> str:
    """Return a credential-free failure category."""
    return str(exc) if isinstance(exc, OIDCError) else type(exc).__name__


def require_config() -> None:
    """Reject disabled or incomplete OIDC configuration."""
    if not settings.oidc_enabled:
        raise HTTPException(404, "Single sign-on is disabled.")
    if (
        not settings.oidc_issuer_url
        or not settings.oidc_client_id
        or settings.oidc_user_match_claim not in {"email", "preferred_username"}
        or not settings.oidc_redirect_uri
        or "openid" not in settings.oidc_scopes.split()
    ):
        raise HTTPException(
            503, "Single sign-on configuration is incomplete or invalid."
        )


def validate_endpoint(url: str) -> str:
    """Require HTTPS, except for local development endpoints."""
    parsed = urlsplit(url)
    if parsed.scheme != "https" and not (
        parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
    ):
        raise OIDCError("OIDC endpoints require HTTPS")
    if not parsed.netloc or parsed.username or parsed.password or parsed.fragment:
        raise OIDCError("Invalid OIDC endpoint")
    return url


async def read_provider_json(
    client: httpx.AsyncClient, method: str, url: str, **kwargs: Any
) -> dict[str, Any]:
    """Read a provider object with a one MiB decompressed response limit."""
    validate_endpoint(url)
    async with client.stream(method, url, **kwargs) as response:
        response.raise_for_status()
        body = bytearray()
        async for chunk in response.aiter_bytes():
            body.extend(chunk)
            if len(body) > 1024 * 1024:
                raise OIDCError("Provider response too large")
    data = json.loads(body)
    if not isinstance(data, dict):
        raise OIDCError("Invalid provider response")
    return data


async def get_json(url: str, *, refresh: bool = False) -> dict[str, Any]:
    """Fetch and cache discovery or signing keys."""
    validate_endpoint(url)
    cached = _provider_cache.get(url)
    if not refresh and cached and cached[0] > time.monotonic():
        return cached[1]
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        data = await read_provider_json(client, "GET", url)
    # Bound memory when administrators change provider settings repeatedly.
    if len(_provider_cache) >= 16:
        _provider_cache.clear()
    _provider_cache[url] = (time.monotonic() + 300, data)
    return data


async def discovery() -> dict[str, Any]:
    """Validate the configured provider discovery document."""
    issuer = settings.oidc_issuer_url
    data = await get_json(issuer.rstrip("/") + "/.well-known/openid-configuration")
    if data.get("issuer") != issuer:
        raise OIDCError("Discovery issuer mismatch")
    for key in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        validate_endpoint(data[key])
    return data


@router.get("/config")
def public_config(response: Response) -> dict[str, Any]:
    """Expose login UI settings without credentials."""
    response.headers["Cache-Control"] = "no-store"
    return {
        "enabled": settings.oidc_enabled,
        "button_label": settings.oidc_button_label,
        "local_login_enabled": not (
            settings.oidc_enabled and settings.oidc_disable_local_login
        ),
    }


@router.get("/start")
async def start(response: Response) -> dict[str, str]:
    """Start a signed, nonce-bound PKCE transaction."""
    require_config()
    try:
        provider = await discovery()
        state, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(3))
        uri = settings.oidc_redirect_uri
        validate_endpoint(uri)
        cookie = jwt.encode(
            {
                "state": state,
                "nonce": nonce,
                "verifier": verifier,
                "redirect_uri": uri,
                "iss": "ourschool-oidc-state",
                "aud": settings.oidc_client_id,
                "exp": int(time.time()) + _TRANSACTION_TTL,
            },
            settings.secret_key,
            algorithm="HS256",
        )
        response.set_cookie(
            _COOKIE,
            cookie,
            max_age=_TRANSACTION_TTL,
            httponly=True,
            secure=uri.startswith("https://"),
            samesite="lax",
            path=_COOKIE_PATH,
        )
        response.headers["Cache-Control"] = "no-store"
        query = urlencode(
            {
                "response_type": "code",
                "client_id": settings.oidc_client_id,
                "redirect_uri": uri,
                "scope": settings.oidc_scopes,
                "state": state,
                "nonce": nonce,
                "code_challenge": base64.urlsafe_b64encode(
                    hashlib.sha256(verifier.encode()).digest()
                )
                .rstrip(b"=")
                .decode(),
                "code_challenge_method": "S256",
            }
        )
        separator = "&" if "?" in provider["authorization_endpoint"] else "?"
        return {
            "authorization_url": provider["authorization_endpoint"] + separator + query
        }
    except Exception as exc:
        logger.warning("OIDC start failed (%s)", authentication_diagnostic(exc))
        raise HTTPException(503, "Single sign-on is currently unavailable.") from None


async def verified_claims(
    provider: dict[str, Any], token: str, nonce: str
) -> dict[str, Any]:
    """Verify the provider signature and required identity claims."""
    if not isinstance(token, str) or len(token.encode()) > 16384:
        raise OIDCError("Invalid ID token size")
    header = jwt.get_unverified_header(token)
    if not header.get("kid"):
        raise OIDCError("Missing signing key ID")
    algorithm = header.get("alg")
    if algorithm not in {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"}:
        raise OIDCError("Unsupported signing algorithm")
    if algorithm not in provider.get(
        "id_token_signing_alg_values_supported", ["RS256"]
    ):
        raise OIDCError("Unadvertised signing algorithm")
    for refresh in (False, True):
        jwks = await get_json(provider["jwks_uri"], refresh=refresh)
        keys = [
            key
            for key in jwks["keys"]
            if key.get("kid") == header.get("kid")
            and key.get("use", "sig") == "sig"
            and key.get("alg", algorithm) == algorithm
        ]
        if len(keys) == 1:
            break
    if len(keys) != 1:
        raise OIDCError("Unknown signing key")
    claims = jwt.decode(
        token,
        jwt.PyJWK.from_dict(keys[0], algorithm=algorithm).key,
        algorithms=[algorithm],
        audience=settings.oidc_client_id,
        issuer=settings.oidc_issuer_url,
        leeway=30,
        options={"require": ["iss", "aud", "exp", "iat", "sub", "nonce"]},
    )
    if not isinstance(claims["sub"], str) or not claims["sub"]:
        raise OIDCError("Invalid subject")
    audiences = claims["aud"]
    if (isinstance(audiences, list) and len(audiences) > 1) or "azp" in claims:
        if claims.get("azp") != settings.oidc_client_id:
            raise OIDCError("Invalid authorized party")
    if not isinstance(claims["nonce"], str) or not secrets.compare_digest(
        claims["nonce"], nonce
    ):
        raise OIDCError("Invalid nonce")
    return claims


def match_user(db: Session, claims: dict[str, Any]) -> User:
    """Resolve a stable identity, or safely link/provision its account."""
    issuer, subject = claims["iss"], claims["sub"]
    linked = (
        db.query(User).filter_by(oidc_issuer=issuer, oidc_subject=subject).one_or_none()
    )
    if linked:
        return linked
    claim = settings.oidc_user_match_claim
    value = claims.get(claim)
    if not isinstance(value, str) or not value.strip():
        raise OIDCError("Missing account claim")
    if claim == "email" and not settings.oidc_allow_unverified_email:
        if claims.get("email_verified") is not True:
            raise OIDCError("Unverified email")
    column = User.email if claim == "email" else User.username
    users = db.query(User).filter(func.lower(column) == value.lower()).all()
    if len(users) > 1:
        raise OIDCError("Ambiguous account")
    if users:
        user = users[0]
        if user.oidc_issuer is not None or user.oidc_subject is not None:
            raise OIDCError("Account already linked to another identity")
        if user.role == UserRole.ADMIN and not settings.oidc_allow_admin_linking:
            raise OIDCError("Administrator linking disabled")
        user.oidc_issuer, user.oidc_subject = issuer, subject
        return user
    if not settings.oidc_auto_provision:
        raise OIDCError("Unknown account")
    if (
        not settings.oidc_allow_unverified_email
        and claims.get("email_verified") is not True
    ):
        raise OIDCError("Unverified provisioning email")
    email = claims.get("email")
    username = claims.get("preferred_username") or (
        email.split("@")[0] if isinstance(email, str) else None
    )
    if not all(isinstance(v, str) and v.strip() for v in (email, username)):
        raise OIDCError("Missing provisioning claims")
    if (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == email.lower(),
                func.lower(User.username) == username.lower(),
            )
        )
        .first()
    ):
        raise OIDCError("Account collision")
    first_name = claims.get("given_name") or username
    last_name = claims.get("family_name") or ""
    if any(
        not isinstance(v, str) or len(v) > 255
        for v in (email, username, first_name, last_name)
    ):
        raise OIDCError("Invalid provisioning claim length")
    user = User(
        oidc_issuer=issuer,
        oidc_subject=subject,
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        hashed_password=get_password_hash(secrets.token_urlsafe(48)),
        role=UserRole.STUDENT,
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.flush()
    return user


@router.post("/callback", response_model=Token)
async def callback(
    data: Callback, request: Request, db: Annotated[Session, Depends(get_db)]
) -> JSONResponse:
    """Validate the transaction before exchanging the authorization code."""
    require_config()
    try:
        transaction = jwt.decode(
            request.cookies.get(_COOKIE, ""),
            settings.secret_key,
            algorithms=["HS256"],
            audience=settings.oidc_client_id,
            issuer="ourschool-oidc-state",
            options={"require": ["exp", "state", "nonce", "verifier", "redirect_uri"]},
        )
        if not secrets.compare_digest(transaction["state"], data.state):
            raise OIDCError("State mismatch")
        provider = await discovery()
        payload = {
            "grant_type": "authorization_code",
            "code": data.code,
            "redirect_uri": transaction["redirect_uri"],
            "client_id": settings.oidc_client_id,
            "code_verifier": transaction["verifier"],
        }
        auth = None
        if settings.oidc_client_secret:
            methods = provider.get(
                "token_endpoint_auth_methods_supported", ["client_secret_basic"]
            )
            if "client_secret_post" in methods:
                payload["client_secret"] = settings.oidc_client_secret
            elif "client_secret_basic" in methods:
                auth = httpx.BasicAuth(
                    quote_plus(settings.oidc_client_id),
                    quote_plus(settings.oidc_client_secret),
                )
            else:
                raise OIDCError("Unsupported client authentication")
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            tokens = await read_provider_json(
                client, "POST", provider["token_endpoint"], data=payload, auth=auth
            )
            claims = await verified_claims(
                provider, tokens["id_token"], transaction["nonce"]
            )
            missing_claim = settings.oidc_user_match_claim not in claims or (
                settings.oidc_user_match_claim == "email"
                and "email_verified" not in claims
            )
            if missing_claim and provider.get("userinfo_endpoint"):
                extra = await read_provider_json(
                    client,
                    "GET",
                    provider["userinfo_endpoint"],
                    headers={"Authorization": "Bearer " + tokens["access_token"]},
                )
                if extra.get("sub") != claims["sub"]:
                    raise OIDCError("Userinfo subject mismatch")
                claims = {**extra, **claims}
        user = match_user(db, claims)
        if not user.is_active:
            raise OIDCError("Inactive account")
        user.must_change_password = False
        result = create_login_session(db, user, authentication_event="oidc_login")
        response = JSONResponse(Token.model_validate(result).model_dump(mode="json"))
    except Exception as exc:
        db.rollback()
        log_authentication_event(
            "oidc_login", success=False, reason=authentication_diagnostic(exc)
        )
        logger.warning("OIDC callback failed (%s)", authentication_diagnostic(exc))
        response = JSONResponse(
            {
                "detail": "Single sign-on failed. Please try again or contact your administrator."
            },
            status_code=401,
        )
    response.delete_cookie(_COOKIE, path=_COOKIE_PATH)
    response.headers["Cache-Control"] = "no-store"
    return response
