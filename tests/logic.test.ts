import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_SETS, describeDifferences, finishCurrentSet, matchSchema, newMatchInput, sameInput, setsWon, withStatus } from "../lib/match";
import { authorizeMatchChange, can } from "../lib/permissions";
import { live } from "./helpers";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("status changes keep a draft consistent", () => {
  it("starting a match gives it an empty current set", () => {
    const m = withStatus(newMatchInput(A, B), "live");
    assert.deepEqual(m.currentSet, { type: "", home: 0, away: 0 });
    assert.equal(matchSchema.safeParse(m).success, true);
  });

  it("finishing saves a scored current set instead of losing it", () => {
    const m = withStatus(live(A, B, { sets: [{ type: "Men", home: 25, away: 20 }], currentSet: { type: "Ladies", home: 25, away: 23 } }), "completed");
    assert.equal(m.sets.length, 2);
    assert.equal(m.currentSet, null);
    assert.equal(matchSchema.safeParse(m).success, true);
  });

  it("finishing drops an untouched 0-0 set and turns broadcast off", () => {
    const m = withStatus(live(A, B, { isBroadcasting: true }), "completed");
    assert.equal(m.sets.length, 0);
    assert.equal(m.isBroadcasting, false);
  });

  it("moving back to scheduled clears sets and broadcast", () => {
    const m = withStatus(live(A, B, { sets: [{ type: "", home: 25, away: 1 }], isBroadcasting: true }), "scheduled");
    assert.deepEqual([m.sets.length, m.currentSet, m.isBroadcasting], [0, null, false]);
  });

  it("finishing a set appends it and starts a new one, up to the limit", () => {
    const m = finishCurrentSet(live(A, B, { currentSet: { type: "Men", home: 25, away: 10 } }));
    assert.deepEqual(m.sets, [{ type: "Men", home: 25, away: 10 }]);
    assert.deepEqual(m.currentSet, { type: "", home: 0, away: 0 });
    const full = live(A, B, { sets: Array.from({ length: MAX_SETS - 1 }, () => ({ type: "", home: 1, away: 0 })) });
    assert.equal(finishCurrentSet(full), full);
  });

  it("counts sets won", () => {
    assert.deepEqual(setsWon([{ type: "", home: 25, away: 1 }, { type: "", home: 1, away: 25 }, { type: "", home: 25, away: 3 }]), { home: 2, away: 1 });
  });
});

describe("permissions", () => {
  const base = live(A, B, { sets: [{ type: "Men", home: 25, away: 20 }] });

  it("admins may do anything valid; the matrix matches the brief", () => {
    assert.equal(authorizeMatchChange("admin", base, { ...base, stage: "Final" }).ok, true);
    assert.equal(can("admin", "manageInvitations"), true);
    assert.equal(can("scorekeeper", "manageInvitations"), false);
    assert.equal(can("scorekeeper", "manageMatchSetup"), false);
    assert.equal(can("scorekeeper", "scoreLiveMatch"), true);
  });

  it("scorekeepers may score but not change setup or history", () => {
    const ok = { ...base, currentSet: { type: "Ladies", home: 3, away: 2 }, isBroadcasting: true };
    assert.equal(authorizeMatchChange("scorekeeper", base, ok).ok, true);
    assert.equal(authorizeMatchChange("scorekeeper", base, { ...base, stage: "x" }).ok, false);
    assert.equal(authorizeMatchChange("scorekeeper", base, { ...base, sets: [] }).ok, false);
    assert.equal(authorizeMatchChange("scorekeeper", { ...base, status: "scheduled", currentSet: null, sets: [] }, base).ok, false);
  });
});

describe("conflict summary", () => {
  it("lists exactly what differs", () => {
    const mine = live(A, B, { currentSet: { type: "", home: 12, away: 10 } });
    const saved = live(A, B, { currentSet: { type: "", home: 14, away: 10 }, isBroadcasting: true });
    const out = describeDifferences(mine, saved, (id) => (id === A ? "Titan" : "Vortex"));
    assert.deepEqual(out, ["Broadcast: yours off, saved on", "Current set: yours 12–10, saved 14–10"]);
    assert.deepEqual(describeDifferences(mine, mine, () => ""), []);
    assert.equal(sameInput(mine, { ...mine }), true);
  });
});
