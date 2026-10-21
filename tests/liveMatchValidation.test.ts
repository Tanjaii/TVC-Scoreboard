import assert from "node:assert/strict";
import test from "node:test";

import { initialLiveMatch } from "../src/data/liveMatch.ts";
import { isLiveMatchData } from "../src/server/liveMatchValidation.ts";

test("accepts the initial live match state", () => {
  assert.equal(isLiveMatchData(initialLiveMatch), true);
});

test("rejects invalid scores and set numbers", () => {
  assert.equal(isLiveMatchData({ ...initialLiveMatch, homeScore: -1 }), false);
  assert.equal(isLiveMatchData({ ...initialLiveMatch, awayScore: 1.5 }), false);
  assert.equal(
    isLiveMatchData({ ...initialLiveMatch, homeScore: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(isLiveMatchData({ ...initialLiveMatch, setNumber: 0 }), false);
});

test("rejects invalid team statistics", () => {
  assert.equal(
    isLiveMatchData({
      ...initialLiveMatch,
      homeStats: { ...initialLiveMatch.homeStats, attackPercent: 101 },
    }),
    false,
  );
  assert.equal(
    isLiveMatchData({
      ...initialLiveMatch,
      awayStats: { ...initialLiveMatch.awayStats, blocks: -1 },
    }),
    false,
  );
});

test("rejects invalid schedule values, oversized names, and unexpected fields", () => {
  assert.equal(
    isLiveMatchData({ ...initialLiveMatch, scheduledStartAt: "not-a-date" }),
    false,
  );
  assert.equal(
    isLiveMatchData({ ...initialLiveMatch, homeTeam: "x".repeat(101) }),
    false,
  );
  assert.equal(
    isLiveMatchData({ ...initialLiveMatch, isAdmin: true }),
    false,
  );
});
