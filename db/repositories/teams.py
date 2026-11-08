"""
Teams repository for TVC Scoreboard (`lib/repo/teams.ts`).
Enforces case-insensitive unique names (`lower(name)`) and `ON DELETE RESTRICT` when a team is used in matches.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal, Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from ..models import Team as TeamModel
from ..session import is_foreign_key_violation, is_unique_violation


@dataclass(frozen=True)
class TeamRecord:
    id: str
    name: str
    shortName: str
    logoUrl: str
    info: str


@dataclass(frozen=True)
class TeamInput:
    name: str
    shortName: str = ""
    logoUrl: str = ""
    info: str = ""


@dataclass(frozen=True)
class TeamResult:
    ok: bool
    team: Optional[TeamRecord] = None
    reason: Optional[Literal["duplicate", "not_found", "in_use"]] = None


def _to_team(row: TeamModel) -> TeamRecord:
    return TeamRecord(
        id=str(row.id),
        name=row.name,
        shortName=row.short_name,
        logoUrl=row.logo_url,
        info=row.info,
    )


def list_teams(db: Session) -> list[TeamRecord]:
    """Lists all teams ordered alphabetically by case-insensitive name."""
    stmt = select(TeamModel).order_by(func.lower(TeamModel.name).asc())
    return [_to_team(t) for t in db.execute(stmt).scalars().all()]


def create_team(db: Session, data: TeamInput) -> TeamResult:
    """Creates a new team, catching `teams_name_key` case-insensitive duplicates."""
    try:
        with db.begin_nested():
            team = TeamModel(
                name=data.name.strip(),
                short_name=data.shortName.strip(),
                logo_url=data.logoUrl.strip(),
                info=data.info.strip(),
            )
            db.add(team)
            db.flush()
            return TeamResult(ok=True, team=_to_team(team))
    except Exception as exc:
        if is_unique_violation(exc):
            return TeamResult(ok=False, reason="duplicate")
        raise


def update_team(db: Session, team_id: str | uuid.UUID, data: TeamInput) -> TeamResult:
    """Updates an existing team by UUID."""
    tid = uuid.UUID(str(team_id)) if not isinstance(team_id, uuid.UUID) else team_id
    try:
        with db.begin_nested():
            stmt = (
                update(TeamModel)
                .where(TeamModel.id == tid)
                .values(
                    name=data.name.strip(),
                    short_name=data.shortName.strip(),
                    logo_url=data.logoUrl.strip(),
                    info=data.info.strip(),
                )
                .returning(TeamModel)
            )
            updated = db.execute(stmt).scalar_one_or_none()
            db.flush()
            if not updated:
                return TeamResult(ok=False, reason="not_found")
            return TeamResult(ok=True, team=_to_team(updated))
    except Exception as exc:
        if is_unique_violation(exc):
            return TeamResult(ok=False, reason="duplicate")
        raise


def delete_team(db: Session, team_id: str | uuid.UUID) -> TeamResult:
    """
    Deletes a team by UUID. Returns `reason="in_use"` if the team is referenced by
    any match (`ON DELETE RESTRICT` foreign key constraint).
    """
    tid = uuid.UUID(str(team_id)) if not isinstance(team_id, uuid.UUID) else team_id
    try:
        with db.begin_nested():
            stmt = delete(TeamModel).where(TeamModel.id == tid).returning(TeamModel.id)
            deleted = db.execute(stmt).first()
            db.flush()
            if not deleted:
                return TeamResult(ok=False, reason="not_found")
            return TeamResult(ok=True)
    except Exception as exc:
        if is_foreign_key_violation(exc):
            return TeamResult(ok=False, reason="in_use")
        raise
