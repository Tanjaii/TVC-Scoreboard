import type { MatchInput, SetScore } from "./match";
import type { Role } from "./auth/session";

export type Decision = { ok: true } | { ok: false; message: string };

const allow: Decision = { ok: true };
const deny = (message: string): Decision => ({ ok: false, message });

/** What each role may do. One place to change if the rules change. */
export const PERMISSIONS = {
  manageMatchSetup: ["admin"],
  manageTeams: ["admin"],
  manageInvitations: ["admin"],
  scoreLiveMatch: ["admin", "scorekeeper"],
} as const satisfies Record<string, readonly Role[]>;

export const can = (role: Role, permission: keyof typeof PERMISSIONS): boolean =>
  (PERMISSIONS[permission] as readonly Role[]).includes(role);

const sameScoringRules = (a: SetScore | null, b?: SetScore | null) =>
  Boolean(a && b) &&
  a!.pointsToWin === b!.pointsToWin &&
  a!.winBy === b!.winBy;

const sameSet = (a: SetScore, b?: SetScore) =>
  Boolean(b) &&
  a.type === b!.type &&
  a.home === b!.home &&
  a.away === b!.away &&
  a.pointsToWin === b!.pointsToWin &&
  a.winBy === b!.winBy;

/**
 * Admins manage everything. Scorekeepers may update live scores and stats,
 * and append the current set to history. They cannot change setup,
 * broadcasting, scoring rules, or existing completed sets.
 */
export function authorizeMatchChange(role: Role, before: MatchInput, after: MatchInput): Decision {
  if (can(role, "manageMatchSetup")) return allow;
  if (!can(role, "scoreLiveMatch")) return deny("Your role cannot change matches.");

  if (before.status !== "live") return deny("Scorekeepers can only update the live match.");

  const setup: (keyof MatchInput)[] = ["homeTeamId", "awayTeamId", "stage", "scheduledAt", "status"];
  const changed = setup.find((key) => before[key] !== after[key]);
  if (changed) return deny("Only an administrator can change match setup.");

  if (before.isBroadcasting !== after.isBroadcasting) {
    return deny("Only an administrator can control the broadcast.");
  }

  if (!sameScoringRules(before.currentSet, after.currentSet)) {
    return deny("Only an administrator can change set scoring rules.");
  }

  const keepsHistory =
    after.sets.length >= before.sets.length &&
    before.sets.every((s, i) => sameSet(s, after.sets[i]));
  if (!keepsHistory) return deny("Only an administrator can change completed sets.");

  // When a scorekeeper appends the current set, its scoring rules must be preserved.
  if (
    after.sets.length > before.sets.length &&
    !sameScoringRules(before.currentSet, after.sets[before.sets.length])
  ) {
    return deny("Scorekeepers cannot change the scoring rules of a completed set.");
  }

  return allow;
}
