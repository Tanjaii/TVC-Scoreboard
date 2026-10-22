import assert from "node:assert/strict";
import test from "node:test";

import { initialCompetitionState } from "../src/data/competitionState.ts";
import { isCompetitionState } from "../src/server/competitionValidation.ts";

const validMatch = {
  id: "match_1",
  homeTeam: "Team A",
  awayTeam: "Team B",
  stage: "Semi-final",
  scheduledStartAt: "2026-10-22T14:00",
  status: "completed",
  sets: [
    { setNumber: 1, homeScore: 25, awayScore: 21 },
    { setNumber: 2, homeScore: 22, awayScore: 25 },
    { setNumber: 3, homeScore: 25, awayScore: 20 },
  ],
};

test("accepts an empty competition before sample data is entered", () => {
  assert.equal(isCompetitionState(initialCompetitionState), true);
});

test("accepts a valid match record", () => {
  assert.equal(isCompetitionState({ matches: [validMatch] }), true);
});

test("rejects duplicate match IDs and duplicate set numbers", () => {
  assert.equal(isCompetitionState({ matches: [validMatch, validMatch] }), false);
  assert.equal(isCompetitionState({
    matches: [{
      ...validMatch,
      sets: [
        { setNumber: 1, homeScore: 25, awayScore: 20 },
        { setNumber: 1, homeScore: 25, awayScore: 22 },
      ],
    }],
  }), false);
});

test("rejects invalid teams, scores, statuses, and unexpected properties", () => {
  assert.equal(isCompetitionState({ matches: [{ ...validMatch, awayTeam: "Team A" }] }), false);
  assert.equal(isCompetitionState({ matches: [{ ...validMatch, status: "finished" }] }), false);
  assert.equal(isCompetitionState({ matches: [{ ...validMatch, sets: [{ setNumber: 1, homeScore: 51, awayScore: 20 }] }] }), false);
  assert.equal(isCompetitionState({ matches: [{ ...validMatch, unexpected: true }] }), false);
});

test("rejects invalid dates and excessive match lists", () => {
  assert.equal(isCompetitionState({ matches: [{ ...validMatch, scheduledStartAt: "not-a-date" }] }), false);
  assert.equal(isCompetitionState({ matches: Array.from({ length: 501 }, (_, index) => ({ ...validMatch, id: `match_${index}` })) }), false);
});
