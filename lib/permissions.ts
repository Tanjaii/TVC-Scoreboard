import type { MatchInput } from "./match";
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

const sameSet = (a: MatchInput["sets"][number], b?: MatchInput["sets"][number]) =>
  Boolean(b) && a.type === b!.type && a.home === b!.home && a.away === b!.away;

/**
 * Decides whether `role` may turn the saved match `before` into `after`.
 * Admins manage everything. Scorekeepers may only operate the live match:
 * current set, scores, team stats, broadcast, and appending finished sets.
 */
export function authorizeMatchChange(role: Role, before: MatchInput, after: MatchInput): Decision {
  if (can(role, "manageMatchSetup")) return allow;
  if (!can(role, "scoreLiveMatch")) return deny("Your role cannot change matches.");

  if (before.status !== "live") return deny("Scorekeepers can only update the live match.");

  const setup: (keyof MatchInput)[] = ["homeTeamId", "awayTeamId", "stage", "scheduledAt", "status"];
  const changed = setup.find((key) => before[key] !== after[key]);
  if (changed) return deny("Only an administrator can change match setup.");

  const keepsHistory = after.sets.length >= before.sets.length && before.sets.every((s, i) => sameSet(s, after.sets[i]));
  if (!keepsHistory) return deny("Only an administrator can change completed sets.");

  return allow;
}
