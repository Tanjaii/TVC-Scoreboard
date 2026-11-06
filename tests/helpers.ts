import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword } from "../lib/auth/password";
import { createSession, type Role } from "../lib/auth/session";
import { setDb, type Db } from "../lib/db";
import { matchSchema, newMatchInput, type MatchInput, type MatchRecord } from "../lib/match";
import { createTeam, type Team } from "../lib/repo/teams";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

/** A real Postgres (in memory) with the production schema, installed as the app's database. */
export async function freshDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(schema);
  const db: Db = {
    query: async (text, params) => (await pg.query(text, params as unknown[])).rows as never,
    transaction: (fn) => pg.transaction((tx) => fn({ query: async (text, params) => (await tx.query(text, params as unknown[])).rows as never })),
  };
  setDb(db);
  return db;
}

export async function staff(db: Db, role: Role, email = `${role}@example.com`) {
  const rows = await db.query<{ id: string }>(
    "insert into users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id",
    [email, `${role} user`, await hashPassword("a-long-test-password"), role],
  );
  const session = await createSession(db, rows[0].id);
  return { id: rows[0].id, cookie: `tvc_session=${session.token}`, email };
}

export async function teams(db: Db, names = ["Titan", "Vortex", "Breeze"]): Promise<Team[]> {
  const out: Team[] = [];
  for (const name of names) {
    const r = await createTeam(db, { name, shortName: name.slice(0, 3).toUpperCase(), logoUrl: "", info: "" });
    if (r.ok) out.push(r.team);
  }
  return out;
}

type Init = { body?: unknown; cookie?: string; origin?: string | null; ip?: string };

export function request(method: string, path: string, init: Init = {}): Request {
  const headers: Record<string, string> = { "x-forwarded-host": "localhost:3000", "x-forwarded-for": init.ip ?? "10.0.0.1" };
  if (init.origin !== null) headers.origin = init.origin ?? "http://localhost:3000";
  if (init.cookie) headers.cookie = init.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function read<T = Record<string, unknown>>(res: Response): Promise<{ status: number; body: T; res: Response }> {
  return { status: res.status, body: (await res.json()) as T, res };
}

export const live = (home: string, away: string, patch: Partial<MatchInput> = {}): MatchInput => ({
  ...newMatchInput(home, away),
  status: "live",
  currentSet: { type: "Mixed", home: 0, away: 0 },
  ...patch,
});

export function assertValid(input: MatchInput) {
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
}

export type Created = { match: MatchRecord };
