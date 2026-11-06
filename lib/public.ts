import type { MatchRecord, SetScore, SideStats } from "./match";
import { setsWon } from "./match";
import type { Team } from "./repo/teams";

export type PublicTeam = { id: string; name: string; shortName: string; logoUrl: string };
export type PublicMatch = {
  id: string;
  stage: string;
  scheduledAt: string | null;
  status: "scheduled" | "live" | "completed";
  home: PublicTeam;
  away: PublicTeam;
  sets: SetScore[];
  currentSet: SetScore | null;
  stats: { home: SideStats; away: SideStats } | null;
  setsWon: { home: number; away: number };
};

export type PublicSnapshot = {
  serverTime: string;
  /** The match in progress. Scores, sets and stats are only present while it is being broadcast. */
  live: { match: PublicMatch; isBroadcasting: boolean } | null;
  upcoming: PublicMatch[];
  results: PublicMatch[];
  teams: (PublicTeam & { info: string })[];
};

const UNKNOWN: PublicTeam = { id: "", name: "To be confirmed", shortName: "TBC", logoUrl: "" };
const byTime = (a: MatchRecord, b: MatchRecord, dir: 1 | -1) => {
  const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : NaN;
  const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : NaN;
  if (Number.isNaN(ta) && Number.isNaN(tb)) return dir * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return dir * (ta - tb);
};

/**
 * Builds what visitors may see. Only saved data goes in, and a live match's scores stay out of
 * the payload entirely until its broadcast is on.
 */
export function buildPublicSnapshot(matches: MatchRecord[], teams: Team[], now = new Date()): PublicSnapshot {
  const publicTeams = new Map<string, PublicTeam>(
    teams.map((t) => [t.id, { id: t.id, name: t.name, shortName: t.shortName || t.name, logoUrl: t.logoUrl }]),
  );
  const team = (id: string) => publicTeams.get(id) ?? UNKNOWN;

  const toPublic = (m: MatchRecord, reveal: boolean): PublicMatch => ({
    id: m.id,
    stage: m.stage,
    scheduledAt: m.scheduledAt,
    status: m.status,
    home: team(m.homeTeamId),
    away: team(m.awayTeamId),
    sets: reveal ? m.sets : [],
    currentSet: reveal ? m.currentSet : null,
    stats: reveal ? m.stats : null,
    setsWon: reveal ? setsWon(m.sets) : { home: 0, away: 0 },
  });

  const liveMatch = matches.find((m) => m.status === "live");
  return {
    serverTime: now.toISOString(),
    live: liveMatch ? { match: toPublic(liveMatch, liveMatch.isBroadcasting), isBroadcasting: liveMatch.isBroadcasting } : null,
    upcoming: matches.filter((m) => m.status === "scheduled").sort((a, b) => byTime(a, b, 1)).slice(0, 12).map((m) => toPublic(m, true)),
    results: matches.filter((m) => m.status === "completed").sort((a, b) => byTime(a, b, -1)).slice(0, 20).map((m) => toPublic(m, true)),
    teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName || t.name, logoUrl: t.logoUrl, info: t.info })),
  };
}
