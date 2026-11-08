"""
One-time staff invitations repository for TVC Scoreboard (`lib/repo/invitations.ts`).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session, aliased

from ..auth import Role, create_session, hash_password, hash_token, new_token
from ..models import Invitation as InvitationModel
from ..models import User
from ..session import is_unique_violation, transaction

INVITE_DAYS = 7
InvitationStatus = Literal["pending", "used", "expired", "revoked"]


@dataclass(frozen=True)
class InvitationRecord:
    id: str
    role: Role
    note: str
    status: InvitationStatus
    createdAt: str
    expiresAt: str
    createdByName: Optional[str]
    usedByName: Optional[str]


@dataclass(frozen=True)
class CreatedInvitation:
    token: str
    id: str
    expiresAt: str


def _status_of(
    used_at: Optional[datetime],
    revoked_at: Optional[datetime],
    expires_at: datetime,
) -> InvitationStatus:
    if used_at is not None:
        return "used"
    if revoked_at is not None:
        return "revoked"
    now = datetime.now(timezone.utc)
    exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
    if exp <= now:
        return "expired"
    return "pending"


def create_invitation(
    db: Session,
    *,
    role: Role,
    note: str = "",
    created_by: Optional[str | uuid.UUID] = None,
    days: int = INVITE_DAYS,
) -> CreatedInvitation:
    """
    Creates a one-time staff invitation link.
    The raw token exists only in this return value; only its SHA-256 hash is stored in Postgres.
    """
    raw_token = new_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=days)
    creator_uuid = (
        uuid.UUID(str(created_by))
        if created_by is not None and not isinstance(created_by, uuid.UUID)
        else created_by
    )
    inv = InvitationModel(
        token_hash=hash_token(raw_token),
        role=role,
        note=note,
        created_by=creator_uuid,
        expires_at=expires_at,
    )
    db.add(inv)
    db.flush()
    return CreatedInvitation(
        token=raw_token,
        id=str(inv.id),
        expiresAt=expires_at.isoformat(),
    )


def list_invitations(db: Session) -> list[InvitationRecord]:
    """Lists the 100 most recent invitations with creator and consumer names."""
    Creator = aliased(User)
    Consumer = aliased(User)
    stmt = (
        select(
            InvitationModel.id,
            InvitationModel.role,
            InvitationModel.note,
            InvitationModel.created_at,
            InvitationModel.expires_at,
            InvitationModel.used_at,
            InvitationModel.revoked_at,
            Creator.name.label("created_by_name"),
            Consumer.name.label("used_by_name"),
        )
        .outerjoin(Creator, Creator.id == InvitationModel.created_by)
        .outerjoin(Consumer, Consumer.id == InvitationModel.used_by)
        .order_by(InvitationModel.created_at.desc())
        .limit(100)
    )
    rows = db.execute(stmt).all()
    return [
        InvitationRecord(
            id=str(r.id),
            role=r.role,  # type: ignore[arg-type]
            note=r.note,
            status=_status_of(r.used_at, r.revoked_at, r.expires_at),
            createdAt=r.created_at.isoformat(),
            expiresAt=r.expires_at.isoformat(),
            createdByName=r.created_by_name,
            usedByName=r.used_by_name,
        )
        for r in rows
    ]


def revoke_invitation(db: Session, invitation_id: str | uuid.UUID) -> bool:
    """Revokes an unused pending invitation."""
    iid = uuid.UUID(str(invitation_id)) if not isinstance(invitation_id, uuid.UUID) else invitation_id
    stmt = (
        update(InvitationModel)
        .where(
            InvitationModel.id == iid,
            InvitationModel.used_at.is_(None),
            InvitationModel.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
        .returning(InvitationModel.id)
    )
    row = db.execute(stmt).first()
    db.flush()
    return row is not None


def peek_invitation(db: Session, token: str) -> Optional[dict[str, Role]]:
    """Checks an invitation link without consuming it so the sign-up UI can display the role."""
    now = datetime.now(timezone.utc)
    stmt = select(InvitationModel.role).where(
        InvitationModel.token_hash == hash_token(token),
        InvitationModel.used_at.is_(None),
        InvitationModel.revoked_at.is_(None),
        InvitationModel.expires_at > now,
    )
    role = db.execute(stmt).scalar_one_or_none()
    return {"role": role} if role else None  # type: ignore[dict-item]


@dataclass(frozen=True)
class AcceptInvitationResult:
    ok: bool
    token: Optional[str] = None
    expiresAt: Optional[datetime] = None
    role: Optional[Role] = None
    reason: Optional[Literal["invalid_link", "email_taken"]] = None


def accept_invitation(
    db: Session,
    *,
    token: str,
    name: str,
    email: str,
    password: str,
) -> AcceptInvitationResult:
    """
    Claims the invitation and creates the user account + session in a single atomic
    transaction so a one-time link works exactly once.
    """
    pwd_hash = hash_password(password)
    now = datetime.now(timezone.utc)
    try:
        with transaction(db) as tx:
            claim_stmt = (
                update(InvitationModel)
                .where(
                    InvitationModel.token_hash == hash_token(token),
                    InvitationModel.used_at.is_(None),
                    InvitationModel.revoked_at.is_(None),
                    InvitationModel.expires_at > now,
                )
                .values(used_at=now)
                .returning(InvitationModel.id, InvitationModel.role)
            )
            claimed = tx.execute(claim_stmt).first()
            if not claimed:
                return AcceptInvitationResult(ok=False, reason="invalid_link")

            new_user = User(
                email=email.strip(),
                name=name.strip(),
                password_hash=pwd_hash,
                role=claimed.role,
            )
            tx.add(new_user)
            tx.flush()

            tx.execute(
                update(InvitationModel)
                .where(InvitationModel.id == claimed.id)
                .values(used_by=new_user.id)
            )
            session_info = create_session(tx, new_user.id)
            return AcceptInvitationResult(
                ok=True,
                token=session_info.token,
                expiresAt=session_info.expires_at,
                role=claimed.role,  # type: ignore[arg-type]
            )
    except Exception as exc:
        if is_unique_violation(exc):
            return AcceptInvitationResult(ok=False, reason="email_taken")
        raise
