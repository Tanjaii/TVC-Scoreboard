"""
Authentication, password hashing (scrypt), token hashing (SHA-256), and session
management for TVC Scoreboard.
Binary-compatible with `lib/auth/password.ts`, `lib/auth/tokens.ts`, and `lib/auth/session.ts`.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session as OrmSession

from .models import Session as SessionModel
from .models import User

Role = Literal["admin", "scorekeeper"]

# Scrypt parameters matching Node.js `lib/auth/password.ts`
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LENGTH = 64
MAXMEM = 32 * 1024 * 1024

PASSWORD_MIN = 12
PASSWORD_MAX = 128

SESSION_COOKIE = "tvc_session"
SESSION_DAYS = 7


def _derive_scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        maxmem=MAXMEM,
        dklen=KEY_LENGTH,
    )


def hash_password(password: str) -> str:
    """
    Hashes a password with scrypt (N=16384, r=8, p=1, dklen=64) using the exact
    wire format `scrypt$16384$8$1$<salt_base64>$<key_base64>` from TVC-Scoreboard.
    """
    salt = os.urandom(16)
    derived = _derive_scrypt(password, salt)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    key_b64 = base64.b64encode(derived).decode("ascii")
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt_b64}${key_b64}"


def verify_password(password: str, stored: str) -> bool:
    """
    Verifies a password against a stored `scrypt$N$r$p$salt$hash` string in constant time.
    """
    parts = stored.split("$")
    if len(parts) != 6:
        return False
    scheme, n_str, r_str, p_str, salt_b64, hash_b64 = parts
    try:
        if (
            scheme != "scrypt"
            or not salt_b64
            or not hash_b64
            or int(n_str) != SCRYPT_N
            or int(r_str) != SCRYPT_R
            or int(p_str) != SCRYPT_P
        ):
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except (ValueError, TypeError):
        return False

    actual = _derive_scrypt(password, salt)
    return len(expected) == len(actual) and hmac.compare_digest(expected, actual)


# Verified against when an email is unknown so response timing does not leak email existence.
DUMMY_HASH = (
    f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}$"
    f"{base64.b64encode(bytes(16)).decode('ascii')}$"
    f"{base64.b64encode(bytes(KEY_LENGTH)).decode('ascii')}"
)


def new_token() -> str:
    """256-bit random token in URL-safe base64 without padding, matching `randomBytes(32).toString('base64url')`."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Only this SHA-256 hex digest is stored in Postgres so a database leak never exposes raw tokens."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SessionUser:
    id: str
    email: str
    name: str
    role: Role


@dataclass(frozen=True)
class CreatedSession:
    token: str
    expires_at: datetime


def create_session(db: OrmSession, user_id: str | uuid.UUID) -> CreatedSession:
    """Creates a new 7-day user session and stores only `hash_token(token)` in PostgreSQL."""
    raw_token = new_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    uid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    session_row = SessionModel(
        user_id=uid,
        token_hash=hash_token(raw_token),
        expires_at=expires_at,
    )
    db.add(session_row)
    db.flush()
    return CreatedSession(token=raw_token, expires_at=expires_at)


def user_for_token(db: OrmSession, token: Optional[str]) -> Optional[SessionUser]:
    """Looks up the active user for a raw session cookie token."""
    if not token:
        return None
    now = datetime.now(timezone.utc)
    stmt = (
        select(User.id, User.email, User.name, User.role)
        .join(SessionModel, SessionModel.user_id == User.id)
        .where(
            SessionModel.token_hash == hash_token(token),
            SessionModel.expires_at > now,
        )
    )
    row = db.execute(stmt).first()
    if not row:
        return None
    return SessionUser(
        id=str(row.id),
        email=row.email,
        name=row.name,
        role=row.role,  # type: ignore[arg-type]
    )


def destroy_session(db: OrmSession, token: Optional[str]) -> None:
    """Deletes a session by its raw token."""
    if not token:
        return
    db.execute(delete(SessionModel).where(SessionModel.token_hash == hash_token(token)))
    db.flush()
