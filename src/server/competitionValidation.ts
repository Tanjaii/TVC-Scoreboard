import type { CompetitionMatch, CompetitionState, SetScore } from "../data/competitionState.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0);
}

function isScore(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 50;
}

function isSetScore(value: unknown): value is SetScore {
  if (!isRecord(value) || Object.keys(value).length !== 3) {
    return false;
  }

  return typeof value.setNumber === "number"
    && Number.isSafeInteger(value.setNumber)
    && value.setNumber >= 1
    && value.setNumber <= 5
    && isScore(value.homeScore)
    && isScore(value.awayScore);
}

export function isCompetitionMatch(value: unknown): value is CompetitionMatch {
  if (!isRecord(value) || Object.keys(value).length !== 7) {
    return false;
  }

  if (
    !isText(value.id, 80)
    || !/^[a-zA-Z0-9_-]+$/.test(value.id)
    || !isText(value.homeTeam, 100)
    || !isText(value.awayTeam, 100)
    || value.homeTeam.trim().toLocaleLowerCase() === value.awayTeam.trim().toLocaleLowerCase()
    || !isText(value.stage, 100, true)
    || !isText(value.scheduledStartAt, 40, true)
    || (value.scheduledStartAt !== "" && !Number.isFinite(Date.parse(value.scheduledStartAt)))
    || !["scheduled", "live", "completed"].includes(String(value.status))
    || !Array.isArray(value.sets)
    || value.sets.length > 5
    || !value.sets.every(isSetScore)
  ) {
    return false;
  }

  const setNumbers = value.sets.map((set) => set.setNumber);
  return new Set(setNumbers).size === setNumbers.length;
}

export function isCompetitionState(value: unknown): value is CompetitionState {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.matches)) {
    return false;
  }

  return value.matches.length <= 500
    && value.matches.every(isCompetitionMatch)
    && new Set(value.matches.map((match) => match.id)).size === value.matches.length;
}
