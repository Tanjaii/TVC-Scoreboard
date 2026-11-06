"""
Users & login rate-limiting repository for TVC Scoreboard (`lib/repo/users.ts`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..auth import DUMMY_HASH, Role, SessionUser, verify_password
from ..models import LoginAttempt, User

LOGIN_WINDOW_MINUTES = 15
MAX_FAILED_PER_EMAIL = 5
MAX_FAILED_PER_IP = 30


@dataclass(frozen=True)
class LoginResult:
    ok: bool
    user: Optional[SessionUser] = None
    reason: Optional[Literal["invalid", "rate_limited"]] = None


def _count_failures(db: Session, key: str) -> int:
    window_start = datetime.now(timezone.utc) - timedelta(minutes=LOGIN_WINDOW_MINUTES)
    stmt = (
        select(func.count())
        .select_from(LoginAttempt)
        .where(LoginAttempt.key == key, LoginAttempt.at > window_start)
    )
    return int(db.execute(stmt).scalar_one())


def attempt_login(db: Session, *, email: str, password: str, ip: str) -> LoginResult:
    """
    Validates user credentials with per-email (5/15m) and per-IP (30/15m) brute-force
    protection and constant-time scrypt verification.
    """
    email_key = f"email:{email.strip().lower()}"
    ip_key = f"ip:{ip}"
    cutoff = datetime.now(timezone.utc) - timedelta(days=1)

    # Purge login attempts older than 1 day
    db.execute(delete(LoginAttempt).where(LoginAttempt.at < cutoff))

    if (
        _count_failures(db, email_key) >= MAX_FAILED_PER_EMAIL
        or _count_failures(db, ip_key) >= MAX_FAILED_PER_IP
    ):
        db.flush()
        return LoginResult(ok=False, reason="rate_limited")

    stmt = select(User).where(func.lower(User.email) == email.strip().lower())
    user = db.execute(stmt).scalar_one_or_none()

    # Always run one password check so timing does not reveal whether the email exists.
    valid = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        db.add_all([LoginAttempt(key=email_key), LoginAttempt(key=ip_key)])
        db.flush()
        return LoginResult(ok=False, reason="invalid")

    db.execute(delete(LoginAttempt).where(LoginAttempt.key == email_key))
    db.flush()
    return LoginResult(
        ok=True,
        user=SessionUser(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role,  # type: ignore[arg-type]
        ),
    )


def count_users(db: Session) -> int:
    """Returns the total number of registered staff accounts."""
    stmt = select(func.count()).select_from(User)
    return int(db.execute(stmt).scalar_one())


def list_users(db: Session) -> list[SessionUser]:
    """Lists all staff users ordered by creation time."""
    stmt = select(User).order_by(User.created_at.asc())
    return [
        SessionUser(
            id=str(u.id),
            email=u.email,
            name=u.name,
            role=u.role,  # type: ignore[arg-type]
        )
        for u in db.execute(stmt).scalars().all()
    ]
