"""
Matches repository for TVC Scoreboard (`lib/repo/matches.ts`).
Implements row-level `SELECT ... FOR UPDATE` locking, version-based optimistic
concurrency detection, role permission checks, and `matches_one_live` partial index handling.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..auth import Role
from ..match_logic import (
    MatchInput,
    MatchRecord,
    MatchStats,
    SetScore,
    authorize_match_change,
)
from ..models import Match as MatchModel
from ..models import User
from ..session import is_foreign_key_violation, is_unique_violation, transaction


def _parse_iso(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    normalized = val.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _to_record(m: MatchModel, updated_by_name: Optional[str]) -> MatchRecord:
    return MatchRecord(
        id=str(m.id),
        version=int(m.version),
        updatedAt=m.updated_at.isoformat(),
        updatedByName=updated_by_name,
        homeTeamId=str(m.home_team_id),
        awayTeamId=str(m.away_team_id),
        stage=m.stage,
        scheduledAt=m.scheduled_at.isoformat() if m.scheduled_at else None,
        status=m.status,  # type: ignore[arg-type]
        sets=[SetScore.from_dict(s) for s in (m.sets or [])],
        currentSet=SetScore.from_dict(m.current_set) if m.current_set else None,
        stats=MatchStats.from_dict(m.stats or {}),
        isBroadcasting=bool(m.is_broadcasting),
    )


def _to_input(record: MatchRecord) -> MatchInput:
    return MatchInput(
        homeTeamId=record.homeTeamId,
        awayTeamId=record.awayTeamId,
        stage=record.stage,
        scheduledAt=record.scheduledAt,
        status=record.status,
        sets=list(record.sets),
        currentSet=record.currentSet,
        stats=record.stats,
        isBroadcasting=record.isBroadcasting,
    )


def list_matches(db: Session) -> list[MatchRecord]:
    """Lists all matches ordered by `scheduled_at NULLS LAST, created_at ASC`."""
    stmt = (
        select(MatchModel, User.name.label("updated_by_name"))
        .outerjoin(User, User.id == MatchModel.updated_by)
        .order_by(MatchModel.scheduled_at.asc().nulls_last(), MatchModel.created_at.asc())
    )
    return [_to_record(row[0], row[1]) for row in db.execute(stmt).all()]


def get_match(db: Session, match_id: str | uuid.UUID) -> Optional[MatchRecord]:
    """Fetches a single match by UUID along with the last editor's name."""
    mid = uuid.UUID(str(match_id)) if not isinstance(match_id, uuid.UUID) else match_id
    stmt = (
        select(MatchModel, User.name.label("updated_by_name"))
        .outerjoin(User, User.id == MatchModel.updated_by)
        .where(MatchModel.id == mid)
    )
    row = db.execute(stmt).first()
    return _to_record(row[0], row[1]) if row else None


@dataclass(frozen=True)
class CreateMatchResult:
    ok: bool
    match: Optional[MatchRecord] = None
    reason: Optional[Literal["unknown_team", "another_live"]] = None


def create_match(
    db: Session,
    data: MatchInput,
    user_id: Optional[str | uuid.UUID] = None,
) -> CreateMatchResult:
    """
    Creates a new match.
    Catches `matches_one_live` partial unique index (`another_live`) and missing team FKs (`unknown_team`).
    """
    uid = uuid.UUID(str(user_id)) if user_id and not isinstance(user_id, uuid.UUID) else user_id
    try:
        with db.begin_nested():
            match = MatchModel(
                home_team_id=uuid.UUID(str(data.homeTeamId)),
                away_team_id=uuid.UUID(str(data.awayTeamId)),
                stage=data.stage.strip(),
                scheduled_at=_parse_iso(data.scheduledAt),
                status=data.status,
                sets=[s.to_dict() for s in data.sets],
                current_set=data.currentSet.to_dict() if data.currentSet else None,
                stats=data.stats.to_dict(),
                is_broadcasting=bool(data.isBroadcasting),
                updated_by=uid,
            )
            db.add(match)
            db.flush()
            created = get_match(db, match.id)
            return CreateMatchResult(ok=True, match=created)
    except Exception as exc:
        if is_unique_violation(exc):
            return CreateMatchResult(ok=False, reason="another_live")
        if is_foreign_key_violation(exc):
            return CreateMatchResult(ok=False, reason="unknown_team")
        raise


@dataclass(frozen=True)
class SaveMatchResult:
    ok: bool
    match: Optional[MatchRecord] = None
    reason: Optional[Literal["not_found", "conflict", "forbidden", "another_live", "unknown_team"]] = None
    message: Optional[str] = None


def save_match(
    db: Session,
    *,
    match_id: str | uuid.UUID,
    expected_version: int,
    data: MatchInput,
    user_id: Optional[str | uuid.UUID],
    role: Role,
) -> SaveMatchResult:
    """
    Saves an edited match only if nobody saved it since the editor loaded it.
    Locks the row with `SELECT ... FOR UPDATE` while comparing `version`,
    checking `role` permissions, and incrementing `version = version + 1`.
    """
    mid = uuid.UUID(str(match_id)) if not isinstance(match_id, uuid.UUID) else match_id
    uid = uuid.UUID(str(user_id)) if user_id and not isinstance(user_id, uuid.UUID) else user_id
    try:
        with transaction(db) as tx:
            lock_stmt = select(MatchModel.id).where(MatchModel.id == mid).with_for_update()
            locked = tx.execute(lock_stmt).first()
            if not locked:
                return SaveMatchResult(ok=False, reason="not_found")

            current = get_match(tx, mid)
            assert current is not None
            if current.version != expected_version:
                return SaveMatchResult(ok=False, reason="conflict", match=current)

            decision = authorize_match_change(role, _to_input(current), data)
            if not decision.ok:
                return SaveMatchResult(ok=False, reason="forbidden", message=decision.message)

            upd_stmt = (
                update(MatchModel)
                .where(MatchModel.id == mid)
                .values(
                    home_team_id=uuid.UUID(str(data.homeTeamId)),
                    away_team_id=uuid.UUID(str(data.awayTeamId)),
                    stage=data.stage.strip(),
                    scheduled_at=_parse_iso(data.scheduledAt),
                    status=data.status,
                    sets=[s.to_dict() for s in data.sets],
                    current_set=data.currentSet.to_dict() if data.currentSet else None,
                    stats=data.stats.to_dict(),
                    is_broadcasting=bool(data.isBroadcasting),
                    version=MatchModel.version + 1,
                    updated_by=uid,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            tx.execute(upd_stmt)
            tx.flush()
            updated = get_match(tx, mid)
            return SaveMatchResult(ok=True, match=updated)
    except Exception as exc:
        if is_unique_violation(exc):
            return SaveMatchResult(ok=False, reason="another_live")
        if is_foreign_key_violation(exc):
            return SaveMatchResult(ok=False, reason="unknown_team")
        raise


def delete_match(db: Session, match_id: str | uuid.UUID) -> bool:
    """Deletes a match by UUID."""
    mid = uuid.UUID(str(match_id)) if not isinstance(match_id, uuid.UUID) else match_id
    stmt = delete(MatchModel).where(MatchModel.id == mid).returning(MatchModel.id)
    row = db.execute(stmt).first()
    db.flush()
    return row is not None
