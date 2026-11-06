import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { acceptInvite, login, logout } from "../lib/api/auth";
import { requireUser } from "../lib/http";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import type { Db } from "../lib/db";
import { createInvitation, peekInvitation } from "../lib/repo/invitations";
import { freshDb, read, request, staff } from "./helpers";

const PASSWORD = "correct horse battery";
const cookieFrom = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    assert.notEqual(a, b);
    assert.equal(await verifyPassword(PASSWORD, a), true);
    assert.equal(await verifyPassword("wrong password!!", a), false);
    assert.equal(await verifyPassword(PASSWORD, "not-a-hash"), false);
  });
});

describe("invitations", () => {
  let db: Db;
  before(async () => { db = await freshDb(); });

  it("creates the account, signs in, and works exactly once", async () => {
    const invite = await createInvitation(db, { role: "scorekeeper", note: "court 1", createdBy: null });
    assert.deepEqual(await peekInvitation(db, invite.token), { role: "scorekeeper" });

    const first = await read(await acceptInvite(request("POST", "/api/auth/accept-invite", {
      body: { token: invite.token, name: "New Person", email: "new@example.com", password: PASSWORD },
    })));
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { role: "scorekeeper" });

    const cookie = cookieFrom(first.res);
    const gate = await requireUser(request("GET", "/x", { cookie }));
    assert.equal("user" in gate && gate.user.role, "scorekeeper");

    const again = await read(await acceptInvite(request("POST", "/api/auth/accept-invite", {
      body: { token: invite.token, name: "Other", email: "other@example.com", password: PASSWORD },
    })));
    assert.equal(again.status, 410);
    assert.equal(await peekInvitation(db, invite.token), null);
  });

  it("never stores the raw token", async () => {
    const invite = await createInvitation(db, { role: "admin", note: "", createdBy: null });
    const rows = await db.query<{ token_hash: string }>("select token_hash from invitations");
    assert.equal(rows.some((r) => r.token_hash === invite.token), false);
  });

  it("rejects expired, revoked and unknown links", async () => {
    const expired = await createInvitation(db, { role: "admin", note: "", createdBy: null });
    await db.query("update invitations set expires_at = now() - interval '1 minute' where id = $1", [expired.id]);
    const revoked = await createInvitation(db, { role: "admin", note: "", createdBy: null });
    await db.query("update invitations set revoked_at = now() where id = $1", [revoked.id]);

    for (const token of [expired.token, revoked.token, "x".repeat(43)]) {
      const r = await read(await acceptInvite(request("POST", "/api/auth/accept-invite", {
        body: { token, name: "A", email: "late@example.com", password: PASSWORD },
      })));
      assert.equal(r.status, 410);
    }
  });

  it("rejects a taken email without burning the link, and weak passwords", async () => {
    await staff(db, "admin", "taken@example.com");
    const invite = await createInvitation(db, { role: "scorekeeper", note: "", createdBy: null });

    const taken = await read(await acceptInvite(request("POST", "/api/auth/accept-invite", {
      body: { token: invite.token, name: "A", email: "TAKEN@example.com", password: PASSWORD },
    })));
    assert.equal(taken.status, 409);
    assert.deepEqual(await peekInvitation(db, invite.token), { role: "scorekeeper" }); // rolled back, still usable

    const weak = await read(await acceptInvite(request("POST", "/api/auth/accept-invite", {
      body: { token: invite.token, name: "A", email: "ok@example.com", password: "short" },
    })));
    assert.equal(weak.status, 422);
  });

  it("refuses cross-site submissions", async () => {
    const invite = await createInvitation(db, { role: "admin", note: "", createdBy: null });
    const r = await read(await acceptInvite(request("POST", "/api/auth/accept-invite", {
      origin: "https://evil.example",
      body: { token: invite.token, name: "A", email: "x@example.com", password: PASSWORD },
    })));
    assert.equal(r.status, 403);
  });
});

describe("sign-in", () => {
  let db: Db;
  before(async () => {
    db = await freshDb();
    await db.query("insert into users (email, name, password_hash, role) values ($1, 'Ada', $2, 'admin')", [
      "ada@example.com", await hashPassword(PASSWORD),
    ]);
  });

  const signIn = (email: string, password: string, ip = "10.0.0.1") =>
    login(request("POST", "/api/auth/login", { body: { email, password }, ip }));

  it("signs in case-insensitively and sets a protected cookie", async () => {
    const r = await read(await signIn("ADA@example.com", PASSWORD));
    assert.equal(r.status, 200);
    const cookie = r.res.headers.get("set-cookie") ?? "";
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.deepEqual(Object.keys((r.body as { user: object }).user).sort(), ["email", "id", "name", "role"]);
  });

  it("gives one message for wrong passwords and unknown emails", async () => {
    const wrong = await read(await signIn("ada@example.com", "not the password", "10.0.0.2"));
    const unknown = await read(await signIn("nobody@example.com", PASSWORD, "10.0.0.3"));
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  it("locks an email out after repeated failures, even with the right password", async () => {
    await db.query("delete from login_attempts"); // earlier tests in this block also recorded failures
    for (let i = 0; i < 5; i++) assert.equal((await signIn("ada@example.com", "bad password!!", "10.0.0.9")).status, 401);
    assert.equal((await signIn("ada@example.com", PASSWORD, "10.0.0.9")).status, 429);
  });

  it("refuses cross-site sign-in", async () => {
    const r = await login(request("POST", "/api/auth/login", { origin: "https://evil.example", body: { email: "a@b.co", password: "x" } }));
    assert.equal(r.status, 403);
  });

  it("sign-out ends the session; expired sessions stop working", async () => {
    const a = await staff(db, "admin", "out@example.com");
    assert.equal("user" in (await requireUser(request("GET", "/x", { cookie: a.cookie }))), true);

    const res = await logout(request("POST", "/api/auth/logout", { cookie: a.cookie }));
    assert.equal(res.status, 200);
    assert.equal("response" in (await requireUser(request("GET", "/x", { cookie: a.cookie }))), true);

    const b = await staff(db, "admin", "exp@example.com");
    await db.query("update sessions set expires_at = now() - interval '1 minute' where user_id = $1", [b.id]);
    assert.equal("response" in (await requireUser(request("GET", "/x", { cookie: b.cookie }))), true);
  });
});
