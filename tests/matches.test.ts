import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import * as api from "../lib/api/matches";
import type { Db } from "../lib/db";
import { newMatchInput, toInput, type MatchRecord } from "../lib/match";
import { freshDb, live, read, request, staff, teams } from "./helpers";

type One = { match: MatchRecord; error?: string; code?: string };

describe("match API", () => {
  let db: Db;
  let admin: Awaited<ReturnType<typeof staff>>;
  let keeper: Awaited<ReturnType<typeof staff>>;
  let t: Awaited<ReturnType<typeof teams>>;

  before(async () => {
    db = await freshDb();
    admin = await staff(db, "admin");
    keeper = await staff(db, "scorekeeper");
    t = await teams(db);
  });

  const save = async (cookie: string, id: string, version: number, match: unknown) =>
    read<One>(await api.save(request("PUT", `/api/admin/matches/${id}`, { cookie, body: { version, match } }), id));

  it("needs a signed-in staff member, an allowed role, and our own origin", async () => {
    const body = newMatchInput(t[0].id, t[1].id);
    assert.equal((await read(await api.create(request("POST", "/x", { body })))).status, 401);
    assert.equal((await read(await api.create(request("POST", "/x", { cookie: keeper.cookie, body })))).status, 403);
    assert.equal((await read(await api.create(request("POST", "/x", { cookie: admin.cookie, body, origin: null })))).status, 403);
    assert.equal((await read(await api.create(request("POST", "/x", { cookie: admin.cookie, body, origin: "https://evil.example" })))).status, 403);
    assert.equal((await read(await api.list(request("GET", "/x")))).status, 401);
  });

  it("validates matches on the server", async () => {
    const bad = [
      { ...newMatchInput(t[0].id, t[0].id) },
      { ...newMatchInput(t[0].id, t[1].id), status: "live" },
      { ...newMatchInput(t[0].id, t[1].id), sets: [{ type: "", home: 25, away: 20 }] },
      { ...newMatchInput(t[0].id, t[1].id), isBroadcasting: true },
      { ...newMatchInput(t[0].id, t[1].id), extra: 1 },
      { ...newMatchInput(t[0].id, t[1].id), stats: { home: { attackEfficiency: 500, blocks: 0, aces: 0, errors: 0 }, away: { attackEfficiency: 0, blocks: 0, aces: 0, errors: 0 } } },
    ];
    for (const body of bad) assert.equal((await read(await api.create(request("POST", "/x", { cookie: admin.cookie, body })))).status, 422);
    const ghost = newMatchInput(t[0].id, "00000000-0000-4000-8000-000000000000");
    assert.equal((await read(await api.create(request("POST", "/x", { cookie: admin.cookie, body: ghost })))).status, 422);
  });

  it("admins create, load and save matches; versions and authorship are tracked", async () => {
    const created = await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: newMatchInput(t[0].id, t[1].id) })));
    assert.equal(created.status, 201);
    assert.equal(created.body.match.version, 1);

    const edited = { ...toInput(created.body.match), stage: "Semi-final", scheduledAt: "2026-11-10T14:00:00.000Z" };
    const saved = await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: 1, match: edited } }), created.body.match.id));
    assert.equal(saved.status, 200);
    assert.equal(saved.body.match.version, 2);
    assert.equal(saved.body.match.stage, "Semi-final");
    assert.equal(saved.body.match.updatedByName, "admin user");
  });

  it("refuses to overwrite newer data and returns the latest copy", async () => {
    const m = (await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: newMatchInput(t[0].id, t[2].id) })))).body.match;
    const mine = { ...toInput(m), stage: "Mine" };
    const theirs = { ...toInput(m), stage: "Theirs" };

    assert.equal((await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: m.version, match: theirs } }), m.id))).status, 200);

    const clash = await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: m.version, match: mine } }), m.id));
    assert.equal(clash.status, 409);
    assert.equal(clash.body.code, "conflict");
    assert.equal(clash.body.match.stage, "Theirs");
    assert.equal(clash.body.match.version, 2);

    // After reviewing, saving on top of the latest version succeeds.
    const retry = await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: 2, match: mine } }), m.id));
    assert.equal(retry.status, 200);
    assert.equal(retry.body.match.stage, "Mine");
  });

  it("allows only one live match at a time", async () => {
    const a = (await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: live(t[0].id, t[1].id) })))).body.match;
    assert.equal(a.status, "live");

    const second = await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: live(t[1].id, t[2].id) })));
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "another_live");

    const sched = (await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: newMatchInput(t[1].id, t[2].id) })))).body.match;
    const start = await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: 1, match: live(t[1].id, t[2].id) } }), sched.id));
    assert.equal(start.status, 409);
    assert.equal(start.body.code, "another_live");

    // finishing the first frees the slot
    const done = { ...toInput(a), status: "completed" as const, currentSet: null, sets: [{ type: "Mixed", home: 25, away: 20 }] };
    assert.equal((await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: a.version, match: done } }), a.id))).status, 200);
    assert.equal((await read<One>(await api.save(request("PUT", "/x", { cookie: admin.cookie, body: { version: 1, match: live(t[1].id, t[2].id) } }), sched.id))).status, 200);
  });

  describe("scorekeeper permissions", () => {
    let m: MatchRecord;
    before(async () => {
      // clear any live match left by earlier tests, then start a fresh one
      await db.query("update matches set status = 'completed', current_set = null, is_broadcasting = false where status = 'live'");
      m = (await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: live(t[0].id, t[1].id, { sets: [{ type: "Men", home: 25, away: 22 }] }) })))).body.match;
    });
    const as = (version: number, match: unknown) => save(keeper.cookie, m.id, version, match);

    it("may update the current set, scores, stats and broadcast", async () => {
      const next = {
        ...toInput(m),
        currentSet: { type: "Ladies", home: 7, away: 5 },
        isBroadcasting: true,
        stats: { ...m.stats, home: { attackEfficiency: 31.5, blocks: 3, aces: 2, errors: 4 } },
      };
      const r = await as(m.version, next);
      assert.equal(r.status, 200);
      assert.equal(r.body.match.currentSet?.home, 7);
      assert.equal(r.body.match.isBroadcasting, true);
      m = r.body.match;
    });

    it("may finish a set (append only)", async () => {
      const next = { ...toInput(m), sets: [...m.sets, { type: "Ladies", home: 25, away: 20 }], currentSet: { type: "", home: 0, away: 0 } };
      const r = await as(m.version, next);
      assert.equal(r.status, 200);
      assert.equal(r.body.match.sets.length, 2);
      m = r.body.match;
    });

    it("may not change setup, history, or finish the match", async () => {
      const base = toInput(m);
      const attempts = [
        { ...base, stage: "Final" },
        { ...base, homeTeamId: t[2].id },
        { ...base, scheduledAt: "2027-01-01T10:00:00.000Z" },
        { ...base, status: "completed" as const, currentSet: null, isBroadcasting: false },
        { ...base, sets: [{ type: "Men", home: 0, away: 25 }, m.sets[1]] },
        { ...base, sets: [m.sets[0]] },
      ];
      for (const a of attempts) assert.equal((await as(m.version, a)).status, 403, JSON.stringify(a).slice(0, 80));
    });

    it("may not create, delete or touch a match that is not live", async () => {
      const sched = (await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: newMatchInput(t[1].id, t[2].id) })))).body.match;
      const r = await read<One>(await api.save(request("PUT", "/x", { cookie: keeper.cookie, body: { version: 1, match: { ...toInput(sched), stage: "x" } } }), sched.id));
      assert.equal(r.status, 403);
      assert.equal((await read(await api.create(request("POST", "/x", { cookie: keeper.cookie, body: newMatchInput(t[0].id, t[1].id) })))).status, 403);
      assert.equal((await read(await api.remove(request("DELETE", "/x", { cookie: keeper.cookie }), sched.id))).status, 403);
    });
  });

  it("deletes matches (admin) and reports unknown ids", async () => {
    const m = (await read<One>(await api.create(request("POST", "/x", { cookie: admin.cookie, body: newMatchInput(t[1].id, t[2].id) })))).body.match;
    assert.equal((await read(await api.remove(request("DELETE", "/x", { cookie: admin.cookie }), m.id))).status, 200);
    assert.equal((await read(await api.get(request("GET", "/x", { cookie: admin.cookie }), m.id))).status, 404);
    assert.equal((await read(await api.get(request("GET", "/x", { cookie: admin.cookie }), "not-a-uuid"))).status, 404);
  });
});
