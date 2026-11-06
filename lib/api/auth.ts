import { z } from "zod";
import { getDb } from "../db";
import { PASSWORD_MAX, PASSWORD_MIN } from "../auth/password";
import {
  clearedSessionCookie, createSession, destroySession, readCookie, SESSION_COOKIE, sessionCookie,
} from "../auth/session";
import { acceptInvitation } from "../repo/invitations";
import { attemptLogin } from "../repo/users";
import { clientIp, fail, json, readJson, safely, sameOrigin } from "../http";

const loginSchema = z.strictObject({ email: z.string().trim().min(1).max(254), password: z.string().min(1).max(PASSWORD_MAX) });

export const login = (req: Request) => safely(async () => {
  if (!sameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  const body = await readJson(req, loginSchema);
  if ("response" in body) return body.response;

  const db = getDb();
  const result = await attemptLogin(db, { ...body.data, ip: clientIp(req) });
  if (!result.ok) {
    return result.reason === "rate_limited"
      ? fail(429, "Too many attempts. Try again in 15 minutes.")
      : fail(401, "The email or password is incorrect.");
  }
  const session = await createSession(db, result.user.id);
  return json({ user: result.user }, 200, { "Set-Cookie": sessionCookie(session.token, session.expiresAt) });
});

export const logout = (req: Request) => safely(async () => {
  if (!sameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  await destroySession(getDb(), readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  return json({ ok: true }, 200, { "Set-Cookie": clearedSessionCookie() });
});

const acceptSchema = z.strictObject({
  token: z.string().min(20).max(100),
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`).max(PASSWORD_MAX),
});

export const acceptInvite = (req: Request) => safely(async () => {
  if (!sameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  const body = await readJson(req, acceptSchema);
  if ("response" in body) return body.response;

  const result = await acceptInvitation(getDb(), body.data);
  if (!result.ok) {
    return result.reason === "email_taken"
      ? fail(409, "An account with that email already exists.")
      : fail(410, "This invitation link is no longer valid. Ask an administrator for a new one.");
  }
  return json({ role: result.role }, 200, { "Set-Cookie": sessionCookie(result.token, result.expiresAt) });
});
