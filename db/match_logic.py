"""
Domain validation, match state transitions, conflict diffing, and role-based
permission checks for TVC Scoreboard (`lib/match.ts` & `lib/permissions.ts`).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Literal, Optional

from .auth import Role

MAX_SETS = 9
MAX_SCORE = 200
MatchStatus = Literal["scheduled", "live", "completed"]


@dataclass
class SetScore:
    """A volleyball set score with free-text category label (e.g. 'Mixed', 'Men', 'Ladies')."""

    type: str = ""
    home: int = 0
    away: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type.strip(), "home": int(self.home), "away": int(self.away)}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SetScore":
        return cls(
            type=str(data.get("type", "")).strip(),
            home=int(data.get("home", 0)),
            away=int(data.get("away", 0)),
        )


@dataclass
class SideStats:
    attackEfficiency: float = 0.0
    blocks: int = 0
    aces: int = 0
    errors: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "attackEfficiency": float(self.attackEfficiency),
            "blocks": int(self.blocks),
            "aces": int(self.aces),
            "errors": int(self.errors),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SideStats":
        return cls(
            attackEfficiency=float(data.get("attackEfficiency", 0)),
            blocks=int(data.get("blocks", 0)),
            aces=int(data.get("aces", 0)),
            errors=int(data.get("errors", 0)),
        )


@dataclass
class MatchStats:
    home: SideStats = field(default_factory=SideStats)
    away: SideStats = field(default_factory=SideStats)

    def to_dict(self) -> dict[str, Any]:
        return {"home": self.home.to_dict(), "away": self.away.to_dict()}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MatchStats":
        return cls(
            home=SideStats.from_dict(data.get("home", {})),
            away=SideStats.from_dict(data.get("away", {})),
        )


@dataclass
class MatchInput:
    homeTeamId: str
    awayTeamId: str
    stage: str = ""
    scheduledAt: Optional[str] = None
    status: MatchStatus = "scheduled"
    sets: list[SetScore] = field(default_factory=list)
    currentSet: Optional[SetScore] = None
    stats: MatchStats = field(default_factory=MatchStats)
    isBroadcasting: bool = False


@dataclass
class MatchRecord(MatchInput):
    id: str = ""
    version: int = 1
    updatedAt: str = ""
    updatedByName: Optional[str] = None


def validate_match_input(m: MatchInput) -> list[str]:
    """
    Validates a MatchInput against all business invariants from `matchSchema` in `lib/match.ts`.
    Returns a list of human-readable error strings (empty if valid).
    """
    errors: list[str] = []
    if m.homeTeamId == m.awayTeamId:
        errors.append("A team cannot play itself.")
    if len(m.stage.strip()) > 60:
        errors.append("Stage label cannot exceed 60 characters.")
    if m.status not in ("scheduled", "live", "completed"):
        errors.append("Invalid match status.")
    if len(m.sets) > MAX_SETS:
        errors.append(f"A match has at most {MAX_SETS} sets.")

    for idx, s in enumerate(m.sets):
        if len(s.type.strip()) > 60:
            errors.append(f"Set {idx + 1} type exceeds 60 characters.")
        if not (0 <= s.home <= MAX_SCORE and 0 <= s.away <= MAX_SCORE):
            errors.append(f"Set {idx + 1} score must be between 0 and {MAX_SCORE}.")

    if m.currentSet is not None:
        if len(m.currentSet.type.strip()) > 60:
            errors.append("Current set type exceeds 60 characters.")
        if not (0 <= m.currentSet.home <= MAX_SCORE and 0 <= m.currentSet.away <= MAX_SCORE):
            errors.append(f"Current set score must be between 0 and {MAX_SCORE}.")

    if m.status == "scheduled" and (len(m.sets) > 0 or m.currentSet is not None):
        errors.append("A scheduled match has no sets yet.")
    if m.status == "live" and m.currentSet is None:
        errors.append("A live match needs a current set.")
    if m.status == "live" and len(m.sets) >= MAX_SETS:
        errors.append(f"A match has at most {MAX_SETS} sets.")
    if m.status != "live" and m.currentSet is not None:
        errors.append("Only a live match has a current set.")
    if m.status != "live" and m.isBroadcasting:
        errors.append("Only a live match can be broadcast.")

    return errors


PERMISSIONS: dict[str, tuple[Role, ...]] = {
    "manageMatchSetup": ("admin",),
    "manageTeams": ("admin",),
    "manageInvitations": ("admin",),
    "scoreLiveMatch": ("admin", "scorekeeper"),
}


def can(role: Role, permission: str) -> bool:
    return role in PERMISSIONS.get(permission, ())


@dataclass(frozen=True)
class PermissionDecision:
    ok: bool
    message: Optional[str] = None


def authorize_match_change(role: Role, before: MatchInput, after: MatchInput) -> PermissionDecision:
    """
    Decides whether `role` may transition the saved match `before` into `after`.
    Admins manage everything. Scorekeepers may only operate the live match:
    current set, scores, team stats, broadcast, and appending finished sets.
    """
    if can(role, "manageMatchSetup"):
        return PermissionDecision(ok=True)
    if not can(role, "scoreLiveMatch"):
        return PermissionDecision(ok=False, message="Your role cannot change matches.")
    if before.status != "live":
        return PermissionDecision(ok=False, message="Scorekeepers can only update the live match.")

    setup_changed = (
        before.homeTeamId != after.homeTeamId
        or before.awayTeamId != after.awayTeamId
        or before.stage != after.stage
        or before.scheduledAt != after.scheduledAt
        or before.status != after.status
    )
    if setup_changed:
        return PermissionDecision(ok=False, message="Only an administrator can change match setup.")

    keeps_history = len(after.sets) >= len(before.sets) and all(
        after.sets[i].to_dict() == before.sets[i].to_dict() for i in range(len(before.sets))
    )
    if not keeps_history:
        return PermissionDecision(ok=False, message="Only an administrator can change completed sets.")

    return PermissionDecision(ok=True)


def sets_won(sets: list[SetScore]) -> dict[str, int]:
    return {
        "home": sum(1 for s in sets if s.home > s.away),
        "away": sum(1 for s in sets if s.away > s.home),
    }


def describe_differences(
    mine: MatchInput,
    saved: MatchInput,
    team_name: Callable[[str], str],
) -> list[str]:
    """Human-readable list of what differs between two MatchInput states for conflict resolution."""
    out: list[str] = []
    if mine.homeTeamId != saved.homeTeamId:
        out.append(f"Home team: yours {team_name(mine.homeTeamId)}, saved {team_name(saved.homeTeamId)}")
    if mine.awayTeamId != saved.awayTeamId:
        out.append(f"Away team: yours {team_name(mine.awayTeamId)}, saved {team_name(saved.awayTeamId)}")
    if mine.stage != saved.stage:
        out.append(f'Stage: yours "{mine.stage}", saved "{saved.stage}"')
    if mine.scheduledAt != saved.scheduledAt:
        out.append("Schedule differs")
    if mine.status != saved.status:
        out.append(f"Status: yours {mine.status}, saved {saved.status}")
    if mine.isBroadcasting != saved.isBroadcasting:
        out.append(
            f"Broadcast: yours {'on' if mine.isBroadcasting else 'off'}, "
            f"saved {'on' if saved.isBroadcasting else 'off'}"
        )
    fmt = lambda s: f"{s.home}–{s.away}" if s else "none"
    if (mine.currentSet.to_dict() if mine.currentSet else None) != (
        saved.currentSet.to_dict() if saved.currentSet else None
    ):
        out.append(f"Current set: yours {fmt(mine.currentSet)}, saved {fmt(saved.currentSet)}")
    if [s.to_dict() for s in mine.sets] != [s.to_dict() for s in saved.sets]:
        mine_sets = ", ".join(fmt(s) for s in mine.sets) or "none"
        saved_sets = ", ".join(fmt(s) for s in saved.sets) or "none"
        out.append(f"Completed sets: yours {mine_sets}; saved {saved_sets}")
    if asdict(mine.stats) != asdict(saved.stats):
        out.append("Team statistics differ")
    return out
