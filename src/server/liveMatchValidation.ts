import type { LiveMatchData, MatchStats } from "../data/liveMatch.js";

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidStats(value: unknown): value is MatchStats {
  if (!isRecord(value)) {
    return false;
  }

  return Object.keys(value).length === 4
    && typeof value.attackPercent === "number"
    && Number.isSafeInteger(value.attackPercent)
    && value.attackPercent >= 0
    && value.attackPercent <= 100
    && isNonNegativeInteger(value.blocks)
    && isNonNegativeInteger(value.aces)
    && isNonNegativeInteger(value.errors);
}

export function isLiveMatchData(value: unknown): value is LiveMatchData {
  if (!isRecord(value)) {
    return false;
  }

  return Object.keys(value).length === 10
    && typeof value.homeTeam === "string"
    && value.homeTeam.length <= 100
    && typeof value.awayTeam === "string"
    && value.awayTeam.length <= 100
    && typeof value.stage === "string"
    && value.stage.length <= 100
    && isNonNegativeInteger(value.homeScore)
    && isNonNegativeInteger(value.awayScore)
    && typeof value.setNumber === "number"
    && Number.isSafeInteger(value.setNumber)
    && value.setNumber >= 1
    && typeof value.scheduledStartAt === "string"
    && value.scheduledStartAt.length <= 40
    && (value.scheduledStartAt === "" || Number.isFinite(Date.parse(value.scheduledStartAt)))
    && isValidStats(value.homeStats)
    && isValidStats(value.awayStats)
    && typeof value.isBroadcasting === "boolean";
}
