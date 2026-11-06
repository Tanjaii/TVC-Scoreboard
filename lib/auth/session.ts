import type { Queryable } from "../db";
import { hashToken, newToken } from "./tokens";

export type Role = "admin" | "scorekeeper";
export type SessionUser = { id: string; email: string; name: string; role: Role };

export const SESSION_COOKIE = "tvc_session";
export const SESSION_DAYS = 7;

export async function createSession(db: Queryable, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query("insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)", [
    userId,
    hashToken(token),
    expiresAt.toISOString(),
  ]);
  return { token, expiresAt };
}

export async function userForToken(db: Queryable, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const rows = await db.query<{ id: string; email: string; name: string; role: Role }>(
    `select u.id, u.email, u.name, u.role
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export async function destroySession(db: Queryable, token: string | undefined): Promise<void> {
  if (token) await db.query("delete from sessions where token_hash = $1", [hashToken(token)]);
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

const secure = () => (process.env.NODE_ENV === "production" ? "; Secure" : "");

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure()}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`;
}
