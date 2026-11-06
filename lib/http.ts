import { z } from "zod";
import { getDb } from "./db";
import { readCookie, SESSION_COOKIE, userForToken, type Role, type SessionUser } from "./auth/session";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** State-changing requests must come from our own pages (on top of SameSite=Lax cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

export type Gate = { user: SessionUser } | { response: Response };

/** Resolves the signed-in staff member from the session cookie, or a 401/403 response. */
export async function requireUser(req: Request, roles?: readonly Role[]): Promise<Gate> {
  const user = await userForToken(getDb(), readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  if (!user) return { response: fail(401, "Sign in to continue.") };
  if (roles && !roles.includes(user.role)) return { response: fail(403, "Your role is not allowed to do that.") };
  return { user };
}

/** Same as requireUser, plus the cross-site check for requests that change data. */
export async function requireMutation(req: Request, roles?: readonly Role[]): Promise<Gate> {
  if (!sameOrigin(req)) return { response: fail(403, "Cross-site requests are not allowed.") };
  return requireUser(req, roles);
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { response: Response }> {
  const body: unknown = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (parsed.success) return { data: parsed.data };
  return {
    response: fail(422, "Some fields are not valid.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    }),
  };
}

/** Last line of defence: unexpected errors become a generic 500 and never leak details. */
export async function safely(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    console.error("Request failed.", error);
    return fail(500, "Something went wrong. Please try again.");
  }
}
