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

"""Symmetric encryption for integration secrets stored in the database.

Used for third-party credentials that must be recoverable (unlike password
hashes) — currently the Paperless-NGX API token. The Fernet key is derived
from ``SECRET_KEY``, so rotating ``SECRET_KEY`` invalidates every stored
secret: callers must treat :class:`SecretDecryptError` as "reconnect
required" and surface a graceful disconnected state, never a 500.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# Domain-separation suffix so this key is never the raw SECRET_KEY (which
# also signs JWTs) nor reusable by a future, unrelated derivation.
_KEY_CONTEXT = ":ourschool-secrets"


class SecretDecryptError(Exception):
    """A stored secret could not be decrypted (SECRET_KEY rotated or data corrupt)."""


def _fernet() -> Fernet:
    digest = hashlib.sha256((settings.secret_key + _KEY_CONTEXT).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret for at-rest storage; returns a Fernet token string."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a stored secret. Raises :class:`SecretDecryptError` on failure."""
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise SecretDecryptError(
            "Stored secret could not be decrypted; it was likely encrypted "
            "with a different SECRET_KEY."
        ) from exc
