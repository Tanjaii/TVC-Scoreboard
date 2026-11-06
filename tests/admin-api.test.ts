import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import * as inv from "../lib/api/invitations";
import * as teamApi from "../lib/api/teams";
import * as matchApi from "../lib/api/matches";
import type { Db } from "../lib/db";
import { newMatchInput } from "../lib/match";
import { peekInvitation } from "../lib/repo/invitations";
import { freshDb, read, request, staff } from "./helpers";

type Cookie = { cookie: string };
const body = (name: string) => ({ name, shortName: name.slice(0, 3), logoUrl: "", info: "" });

describe("teams", () => {
  let db: Db;
  let admin: Cookie;
  let keeper: Cookie;
  before(async () => { db = await freshDb(); admin = await staff(db, "admin"); keeper = await staff(db, "scorekeeper"); });

  it("only admins manage teams; staff may read them", async () => {
    assert.equal((await read(await teamApi.create(request("POST", "/x", { cookie: keeper.cookie, body: body("Titan") })))).status, 403);
    assert.equal((await read(await teamApi.create(request("POST", "/x", { body: body("Titan") })))).status, 401);
    assert.equal((await read(await teamApi.list(request("GET", "/x", { cookie: keeper.cookie })))).status, 200);
  });

  it("creates, rejects duplicate names, edits and validates logos", async () => {
    const made = await read<{ team: { id: string } }>(await teamApi.create(request("POST", "/x", { cookie: admin.cookie, body: body("Titan") })));
    assert.equal(made.status, 201);
    assert.equal((await read(await teamApi.create(request("POST", "/x", { cookie: admin.cookie, body: body("TITAN") })))).status, 409);
    assert.equal((await read(await teamApi.create(request("POST", "/x", { cookie: admin.cookie, body: { ...body("Odd"), logoUrl: "javascript:alert(1)" } })))).status, 422);
    const edited = await read<{ team: { name: string } }>(await teamApi.update(request("PUT", "/x", { cookie: admin.cookie, body: { ...body("Titan Spikers"), logoUrl: "/assets/t.png" } }), made.body.team.id));
    assert.equal(edited.body.team.name, "Titan Spikers");
  });

  it("will not delete a team that a match uses", async () => {
    const a = (await read<{ team: { id: string } }>(await teamApi.create(request("POST", "/x", { cookie: admin.cookie, body: body("Alpha") })))).body.team.id;
    const b = (await read<{ team: { id: string } }>(await teamApi.create(request("POST", "/x", { cookie: admin.cookie, body: body("Bravo") })))).body.team.id;
    await matchApi.create(request("POST", "/x", { cookie: admin.cookie, body: newMatchInput(a, b) }));
    assert.equal((await read(await teamApi.remove(request("DELETE", "/x", { cookie: admin.cookie }), a))).status, 409);
    const free = (await read<{ team: { id: string } }>(await teamApi.create(request("POST", "/x", { cookie: admin.cookie, body: body("Charlie") })))).body.team.id;
    assert.equal((await read(await teamApi.remove(request("DELETE", "/x", { cookie: admin.cookie }), free))).status, 200);
  });
});

describe("invitation management", () => {
  let db: Db;
  let admin: Cookie;
  let keeper: Cookie;
  before(async () => { db = await freshDb(); admin = await staff(db, "admin"); keeper = await staff(db, "scorekeeper"); });

  it("is admin-only", async () => {
    const make = (cookie?: string) => inv.create(request("POST", "/x", { cookie, body: { role: "scorekeeper", note: "x" } }));
    assert.equal((await read(await make(keeper.cookie))).status, 403);
    assert.equal((await read(await make())).status, 401);
    assert.equal((await read(await inv.list(request("GET", "/x", { cookie: keeper.cookie })))).status, 403);
  });

  it("shows the link once, lists status, and revokes", async () => {
    const made = await read<{ id: string; path: string }>(await inv.create(request("POST", "/x", { cookie: admin.cookie, body: { role: "scorekeeper", note: "court 2" } })));
    assert.equal(made.status, 201);
    assert.match(made.body.path, /^\/invite\/[A-Za-z0-9_-]{43}$/);
    const token = made.body.path.split("/").pop()!;
    assert.deepEqual(await peekInvitation(db, token), { role: "scorekeeper" });

    const listed = await read<{ invitations: { id: string; status: string; note: string }[] }>(await inv.list(request("GET", "/x", { cookie: admin.cookie })));
    assert.equal(JSON.stringify(listed.body).includes(token), false); // the link cannot be recovered later
    assert.deepEqual(listed.body.invitations.map((i) => [i.note, i.status]), [["court 2", "pending"]]);

    assert.equal((await read(await inv.revoke(request("DELETE", "/x", { cookie: admin.cookie }), made.body.id))).status, 200);
    assert.equal(await peekInvitation(db, token), null);
    assert.equal((await read(await inv.revoke(request("DELETE", "/x", { cookie: admin.cookie }), made.body.id))).status, 404);
  });

  it("rejects unknown roles", async () => {
    const r = await read(await inv.create(request("POST", "/x", { cookie: admin.cookie, body: { role: "owner", note: "" } })));
    assert.equal(r.status, 422);
  });
});
