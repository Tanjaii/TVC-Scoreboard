import { z } from "zod";

export const MAX_SETS = 9;
export const MAX_SCORE = 200;

export const setScoreSchema = z.strictObject({
  /** Free-text label chosen by admins, e.g. "Mixed (4 ladies + 2 men)", "Men", "Ladies". */
  type: z.string().trim().max(60),
  home: z.int().min(0).max(MAX_SCORE),
  away: z.int().min(0).max(MAX_SCORE),
});

const sideStatsSchema = z.strictObject({
  attackEfficiency: z.number().min(-100).max(100),
  blocks: z.int().min(0).max(999),
  aces: z.int().min(0).max(999),
  errors: z.int().min(0).max(999),
});

export const matchSchema = z
  .strictObject({
    homeTeamId: z.uuid(),
    awayTeamId: z.uuid(),
    stage: z.string().trim().max(60),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
    status: z.enum(["scheduled", "live", "completed"]),
    sets: z.array(setScoreSchema).max(MAX_SETS),
    currentSet: setScoreSchema.nullable(),
    stats: z.strictObject({ home: sideStatsSchema, away: sideStatsSchema }),
    isBroadcasting: z.boolean(),
  })
  .superRefine((m, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
    if (m.homeTeamId === m.awayTeamId) issue("A team cannot play itself.", ["awayTeamId"]);
    if (m.status === "scheduled" && (m.sets.length > 0 || m.currentSet)) {
      issue("A scheduled match has no sets yet.", ["status"]);
    }
    if (m.status === "live" && !m.currentSet) issue("A live match needs a current set.", ["currentSet"]);
    if (m.status === "live" && m.sets.length >= MAX_SETS) issue(`A match has at most ${MAX_SETS} sets.`, ["sets"]);
    if (m.status !== "live" && m.currentSet) issue("Only a live match has a current set.", ["currentSet"]);
    if (m.status !== "live" && m.isBroadcasting) issue("Only a live match can be broadcast.", ["isBroadcasting"]);
  });

export type SetScore = z.infer<typeof setScoreSchema>;
export type SideStats = z.infer<typeof sideStatsSchema>;
export type MatchInput = z.infer<typeof matchSchema>;
export type MatchStatus = MatchInput["status"];

export type MatchRecord = MatchInput & {
  id: string;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
};

export const emptySideStats = (): SideStats => ({ attackEfficiency: 0, blocks: 0, aces: 0, errors: 0 });
export const emptySet = (): SetScore => ({ type: "", home: 0, away: 0 });

export function newMatchInput(homeTeamId: string, awayTeamId: string): MatchInput {
  return {
    homeTeamId,
    awayTeamId,
    stage: "",
    scheduledAt: null,
    status: "scheduled",
    sets: [],
    currentSet: null,
    stats: { home: emptySideStats(), away: emptySideStats() },
    isBroadcasting: false,
  };
}

export function toInput(record: MatchRecord): MatchInput {
  const { id: _id, version: _v, updatedAt: _u, updatedByName: _n, ...input } = record;
  return input;
}

const hasScore = (s: SetScore | null) => Boolean(s && (s.home > 0 || s.away > 0));

/**
 * Moves a draft to another status and keeps it consistent.
 * Finishing a match saves any scored current set as a completed set rather than losing it.
 */
export function withStatus(draft: MatchInput, status: MatchStatus): MatchInput {
  if (status === draft.status) return draft;
  if (status === "live") {
    return { ...draft, status, currentSet: draft.currentSet ?? emptySet() };
  }
  const sets = status === "completed" && hasScore(draft.currentSet) && draft.sets.length < MAX_SETS
    ? [...draft.sets, draft.currentSet as SetScore]
    : status === "scheduled" ? [] : draft.sets;
  return { ...draft, status, sets, currentSet: null, isBroadcasting: false };
}

/** Saves the current set as completed and starts a fresh one. */
export function finishCurrentSet(draft: MatchInput): MatchInput {
  if (draft.status !== "live" || !draft.currentSet || draft.sets.length >= MAX_SETS - 1) return draft;
  return { ...draft, sets: [...draft.sets, draft.currentSet], currentSet: emptySet() };
}

export function setsWon(sets: SetScore[]): { home: number; away: number } {
  return {
    home: sets.filter((s) => s.home > s.away).length,
    away: sets.filter((s) => s.away > s.home).length,
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const sameInput = (a: MatchInput, b: MatchInput) => sameJson(a, b);

/** Human-readable list of what differs, used in the conflict dialog. */
export function describeDifferences(mine: MatchInput, saved: MatchInput, teamName: (id: string) => string): string[] {
  const out: string[] = [];
  if (mine.homeTeamId !== saved.homeTeamId) out.push(`Home team: yours ${teamName(mine.homeTeamId)}, saved ${teamName(saved.homeTeamId)}`);
  if (mine.awayTeamId !== saved.awayTeamId) out.push(`Away team: yours ${teamName(mine.awayTeamId)}, saved ${teamName(saved.awayTeamId)}`);
  if (mine.stage !== saved.stage) out.push(`Stage: yours "${mine.stage}", saved "${saved.stage}"`);
  if (mine.scheduledAt !== saved.scheduledAt) out.push("Schedule differs");
  if (mine.status !== saved.status) out.push(`Status: yours ${mine.status}, saved ${saved.status}`);
  if (mine.isBroadcasting !== saved.isBroadcasting) {
    out.push(`Broadcast: yours ${mine.isBroadcasting ? "on" : "off"}, saved ${saved.isBroadcasting ? "on" : "off"}`);
  }
  const fmt = (s: SetScore | null) => (s ? `${s.home}–${s.away}` : "none");
  if (!sameJson(mine.currentSet, saved.currentSet)) out.push(`Current set: yours ${fmt(mine.currentSet)}, saved ${fmt(saved.currentSet)}`);
  if (!sameJson(mine.sets, saved.sets)) {
    out.push(`Completed sets: yours ${mine.sets.map(fmt).join(", ") || "none"}; saved ${saved.sets.map(fmt).join(", ") || "none"}`);
  }
  if (!sameJson(mine.stats, saved.stats)) out.push("Team statistics differ");
  return out;
}
