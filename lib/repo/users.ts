import type { Queryable } from "../db";
import { DUMMY_HASH, verifyPassword } from "../auth/password";
import type { Role } from "../auth/session";

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILED_PER_EMAIL = 5;
export const MAX_FAILED_PER_IP = 30;

export type LoginResult =
  | { ok: true; user: { id: string; email: string; name: string; role: Role } }
  | { ok: false; reason: "invalid" | "rate_limited" };

async function failures(db: Queryable, key: string): Promise<number> {
  const rows = await db.query<{ n: string }>(
    `select count(*)::text as n from login_attempts where key = $1 and at > now() - ($2 || ' minutes')::interval`,
    [key, String(LOGIN_WINDOW_MINUTES)],
  );
  return Number(rows[0].n);
}

export async function attemptLogin(db: Queryable, args: { email: string; password: string; ip: string }): Promise<LoginResult> {
  const emailKey = `email:${args.email.toLowerCase()}`;
  const ipKey = `ip:${args.ip}`;

  await db.query("delete from login_attempts where at < now() - interval '1 day'");
  if ((await failures(db, emailKey)) >= MAX_FAILED_PER_EMAIL || (await failures(db, ipKey)) >= MAX_FAILED_PER_IP) {
    return { ok: false, reason: "rate_limited" };
  }

  const rows = await db.query<{ id: string; email: string; name: string; role: Role; password_hash: string }>(
    "select id, email, name, role, password_hash from users where lower(email) = lower($1)",
    [args.email],
  );
  const user = rows[0];
  // Always run one password check so timing does not reveal whether the email exists.
  const valid = await verifyPassword(args.password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !valid) {
    await db.query("insert into login_attempts (key) values ($1), ($2)", [emailKey, ipKey]);
    return { ok: false, reason: "invalid" };
  }

  await db.query("delete from login_attempts where key = $1", [emailKey]);
  return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function countUsers(db: Queryable): Promise<number> {
  return Number((await db.query<{ n: string }>("select count(*)::text as n from users"))[0].n);
}
