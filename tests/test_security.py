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

"""Unit tests for app.core.security password/key helpers.

These tests are self-contained (no database required) and cover three concerns:

1. BACKWARD COMPATIBILITY — the new bcrypt-direct implementation must verify
   hashes that were produced by the old passlib 1.7.4 / bcrypt 4.0.1 stack.
   The fixture hashes below were generated with:

       from passlib.context import CryptContext
       ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
       ctx.hash(<secret>)

   They are hardcoded here so the test is reproducible even after passlib is
   removed from the dependency tree.

2. TRUNCATION EQUIVALENCE — bcrypt silently ignores bytes beyond position 72.
   passlib replicated this; our explicit _normalize() must do the same so
   passwords/keys longer than 72 bytes that existed before the migration
   continue to verify.

3. ROUND TRIP — new hashes produced by the migrated code hash-then-verify
   correctly and reject wrong inputs.
"""

import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-123456")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unused:unused@localhost/unused")

from app.core.security import (  # noqa: E402
    get_password_hash,
    hash_api_key,
    verify_api_key,
    verify_password,
)

# ---------------------------------------------------------------------------
# Backward-compatibility fixtures
# Hashes produced by passlib 1.7.4 + bcrypt 4.0.1 on 2026-06-20.
# ---------------------------------------------------------------------------

# Plain password: "correcthorsebatterystaple"
NORMAL_HASH = "$2b$12$BIc4nRIgsWbXoFKBHThSBOliRmiUjHg3mAVk3npCRsLp3u.N4ReLy"

# Password of 80 ASCII "A" characters (passlib truncated silently at 72 bytes)
OVER72_BYTES_HASH = "$2b$12$bvwC2QtHhC9edVoe3IKjBuCWvnnUK7j1ZG535Rmy2w0/8WAZuxu5W"

# Multibyte UTF-8 password: "pässwörd123!ÄÖÜ"
UTF8_MULTIBYTE_HASH = "$2b$12$RTEEX95pI4iqCQwROyNWNOMWWpAv.MTM1Cn6h2K4lLPcUiCP.u/6i"

# API key (typical os_… token, ~46 chars, well under 72 bytes)
API_KEY_SECRET = "os_ABCDEFGHIJ1234567890ABCDEFGHIJ1234567890"
API_KEY_HASH = "$2b$12$YLpxiKQ6pCFHT/7Ar/vzguOVA8yhmotmKwSiS9IFXuQF1G24NRDkq"


# ---------------------------------------------------------------------------
# 1. Backward compatibility — verify passlib-produced hashes
# ---------------------------------------------------------------------------


class TestBackwardCompat:
    def test_normal_password_verifies(self):
        assert verify_password("correcthorsebatterystaple", NORMAL_HASH) is True

    def test_normal_password_wrong_secret_rejected(self):
        assert verify_password("wrongpassword", NORMAL_HASH) is False

    def test_over72_bytes_password_verifies(self):
        assert verify_password("A" * 80, OVER72_BYTES_HASH) is True

    def test_utf8_multibyte_password_verifies(self):
        assert verify_password("pässwörd123!ÄÖÜ", UTF8_MULTIBYTE_HASH) is True

    def test_utf8_wrong_secret_rejected(self):
        assert verify_password("wrongpassword", UTF8_MULTIBYTE_HASH) is False

    def test_api_key_verifies(self):
        assert verify_api_key(API_KEY_SECRET, API_KEY_HASH) is True

    def test_api_key_wrong_secret_rejected(self):
        assert verify_api_key("os_WRONGKEY123", API_KEY_HASH) is False


# ---------------------------------------------------------------------------
# 2. Truncation equivalence — 72-byte boundary behaviour
# ---------------------------------------------------------------------------


class TestTruncation:
    def test_over72_and_truncated_prefix_both_verify_same_hash(self):
        """A hash of an 80-char secret must accept the same 72-char prefix."""
        # Hash the over-length secret with the new implementation
        h = get_password_hash("B" * 80)
        # Both the full (truncated-at-72) and exactly-72 version must verify
        assert verify_password("B" * 80, h) is True
        assert verify_password("B" * 72, h) is True

    def test_over72_does_not_raise(self):
        """Inputs beyond 72 bytes must not raise ValueError (bcrypt 5.x guard)."""
        long_pw = "C" * 200
        h = get_password_hash(long_pw)
        assert verify_password(long_pw, h) is True

    def test_multibyte_truncation_at_byte_boundary(self):
        """Truncation is at 72 *bytes*, not 72 chars; multibyte chars near the
        boundary should not raise and should verify consistently."""
        # Each "é" is 2 bytes in UTF-8; 36 × "é" = 72 bytes exactly
        secret_72_bytes = "é" * 36
        # Append more chars to push it over 72 bytes
        secret_over = secret_72_bytes + "extra"
        h = get_password_hash(secret_over)
        # Both the over-length version and the 72-byte version must verify
        assert verify_password(secret_over, h) is True
        assert verify_password(secret_72_bytes, h) is True

    def test_passlib_over72_compat_with_truncated_prefix(self):
        """Confirm the passlib-produced over-72 hash also accepts exactly the
        72-byte prefix (cross-library truncation equivalence)."""
        assert verify_password("A" * 72, OVER72_BYTES_HASH) is True


# ---------------------------------------------------------------------------
# 3. Round-trip — new hashes work end-to-end
# ---------------------------------------------------------------------------


class TestRoundTrip:
    def test_password_round_trip(self):
        pw = "SecurePassw0rd!#"
        assert verify_password(pw, get_password_hash(pw)) is True

    def test_password_wrong_secret_rejected(self):
        h = get_password_hash("SecurePassw0rd!#")
        assert verify_password("DifferentPassword", h) is False

    def test_api_key_round_trip(self):
        key = "os_abcdefghijklmnopqrstuvwxyz012345"
        assert verify_api_key(key, hash_api_key(key)) is True

    def test_api_key_wrong_secret_rejected(self):
        key = "os_abcdefghijklmnopqrstuvwxyz012345"
        assert verify_api_key("os_wrongkey", hash_api_key(key)) is False

    def test_hashes_are_unique(self):
        """bcrypt must produce a different salt each call."""
        pw = "samepassword"
        assert get_password_hash(pw) != get_password_hash(pw)

    def test_malformed_hash_returns_false_not_raises(self):
        """A corrupted stored hash must not propagate an exception."""
        assert verify_password("anypassword", "not_a_valid_hash") is False
        assert verify_api_key("anykey", "not_a_valid_hash") is False
