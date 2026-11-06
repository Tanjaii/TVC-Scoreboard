import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { SESSION_COOKIE, userForToken, type Role, type SessionUser } from "./auth/session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userForToken(getDb(), jar.get(SESSION_COOKIE)?.value);
}

/** Pages call this on every request: layouts alone are not re-run on client navigation. */
export async function requireStaff(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/admin");
  return user;
}
