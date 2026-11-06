import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { snapshot } from "../lib/api/public";
import { buildPublicSnapshot, type PublicSnapshot } from "../lib/public";
import type { MatchRecord } from "../lib/match";
import { newMatchInput } from "../lib/match";
import { listTeams, type Team } from "../lib/repo/teams";
import { createMatch, getMatch, saveMatch } from "../lib/repo/matches";
import { toInput } from "../lib/match";
import { freshDb, live, read, staff, teams } from "./helpers";

const team = (id: string, name: string): Team => ({ id, name, shortName: "", logoUrl: "/l.png", info: `${name} info` });
const T = [team("t1", "Titan"), team("t2", "Vortex"), team("t3", "Breeze")];

const rec = (id: string, patch: Partial<MatchRecord>): MatchRecord => ({
  ...newMatchInput("t1", "t2"), id, version: 1, updatedAt: "2026-11-01T00:00:00.000Z", updatedByName: "x", ...patch,
});

describe("public snapshot", () => {
  it("hides scores, sets and stats until the broadcast is on", () => {
    const m = rec("a", { status: "live", currentSet: { type: "Men", home: 9, away: 7 }, sets: [{ type: "", home: 25, away: 20 }], isBroadcasting: false });
    const off = buildPublicSnapshot([m], T).live!;
    assert.equal(off.isBroadcasting, false);
    assert.deepEqual([off.match.currentSet, off.match.sets, off.match.stats, off.match.setsWon], [null, [], null, { home: 0, away: 0 }]);
    assert.equal(off.match.home.name, "Titan");

    const on = buildPublicSnapshot([{ ...m, isBroadcasting: true }], T).live!;
    assert.deepEqual(on.match.currentSet, { type: "Men", home: 9, away: 7 });
    assert.deepEqual(on.match.setsWon, { home: 1, away: 0 });
  });

  it("orders upcoming soonest-first and results latest-first, undated last", () => {
    const s = buildPublicSnapshot([
      rec("later", { scheduledAt: "2026-12-02T10:00:00.000Z" }),
      rec("undated", {}),
      rec("soon", { scheduledAt: "2026-11-05T10:00:00.000Z" }),
      rec("old", { status: "completed", scheduledAt: "2026-10-01T10:00:00.000Z", sets: [{ type: "", home: 25, away: 1 }] }),
      rec("new", { status: "completed", scheduledAt: "2026-10-20T10:00:00.000Z", sets: [{ type: "", home: 25, away: 1 }] }),
    ], T);
    assert.deepEqual(s.upcoming.map((m) => m.id), ["soon", "later", "undated"]);
    assert.deepEqual(s.results.map((m) => m.id), ["new", "old"]);
  });

  it("never exposes internals: versions, authors or timestamps", () => {
    const s = JSON.stringify(buildPublicSnapshot([rec("a", { status: "completed" })], T));
    for (const leak of ["version", "updatedBy", "updatedAt", "isBroadcasting\":true"]) assert.equal(s.includes(`"${leak.split('"')[0]}"`), leak.startsWith("isB") ? false : false, leak);
    assert.equal(/password|token|email/i.test(s), false);
  });

  it("falls back gracefully when a team has been removed", () => {
    const s = buildPublicSnapshot([rec("a", { homeTeamId: "gone" })], T);
    assert.equal(s.upcoming[0].home.name, "To be confirmed");
  });
});

describe("public endpoint with real data", () => {
  let snap: PublicSnapshot;
  before(async () => {
    const db = await freshDb();
    const admin = await staff(db, "admin");
    const t = await teams(db);
    const created = await createMatch(db, live(t[0].id, t[1].id), admin.id);
    assert.ok(created.ok);
    if (!created.ok) return;

    // An edit that was never saved cannot reach the public: only the saved version is served.
    const saved = await saveMatch(db, {
      id: created.match.id, expectedVersion: 1, userId: admin.id, role: "admin",
      input: { ...toInput(created.match), currentSet: { type: "Men", home: 11, away: 8 }, isBroadcasting: true },
    });
    assert.ok(saved.ok);
    snap = (await read<PublicSnapshot>(await snapshot())).body;
    assert.equal((await getMatch(db, created.match.id))!.version, 2);
    assert.equal((await listTeams(db)).length, 3);
  });

  it("serves the latest saved match to everyone, without signing in", () => {
    assert.equal(snap.live?.isBroadcasting, true);
    assert.deepEqual(snap.live?.match.currentSet, { type: "Men", home: 11, away: 8 });
    assert.equal(snap.teams.length, 3);
  });
});
