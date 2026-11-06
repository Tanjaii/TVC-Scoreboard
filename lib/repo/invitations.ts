import type { Db, Queryable } from "../db";
import { isUniqueViolation } from "../db";
import { hashPassword } from "../auth/password";
import { createSession, type Role } from "../auth/session";
import { hashToken, newToken } from "../auth/tokens";

export const INVITE_DAYS = 7;

export type InvitationStatus = "pending" | "used" | "expired" | "revoked";
export type Invitation = {
  id: string;
  role: Role;
  note: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  createdByName: string | null;
  usedByName: string | null;
};

type InviteRow = {
  id: string; role: Role; note: string; created_at: Date | string; expires_at: Date | string;
  used_at: Date | string | null; revoked_at: Date | string | null;
  created_by_name: string | null; used_by_name: string | null;
};

const statusOf = (r: InviteRow): InvitationStatus =>
  r.used_at ? "used" : r.revoked_at ? "revoked" : new Date(r.expires_at).getTime() <= Date.now() ? "expired" : "pending";

export async function createInvitation(
  db: Queryable,
  args: { role: Role; note: string; createdBy: string | null; days?: number },
): Promise<{ token: string; id: string; expiresAt: string }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + (args.days ?? INVITE_DAYS) * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db.query<{ id: string }>(
    "insert into invitations (token_hash, role, note, created_by, expires_at) values ($1, $2, $3, $4, $5) returning id",
    [hashToken(token), args.role, args.note, args.createdBy, expiresAt],
  );
  // The raw token exists only in this return value; it is never stored.
  return { token, id: rows[0].id, expiresAt };
}

export async function listInvitations(db: Queryable): Promise<Invitation[]> {
  const rows = await db.query<InviteRow>(
    `select i.id, i.role, i.note, i.created_at, i.expires_at, i.used_at, i.revoked_at,
            c.name as created_by_name, u.name as used_by_name
       from invitations i
       left join users c on c.id = i.created_by
       left join users u on u.id = i.used_by
      order by i.created_at desc limit 100`,
  );
  return rows.map((r) => ({
    id: r.id, role: r.role, note: r.note, status: statusOf(r),
    createdAt: new Date(r.created_at).toISOString(), expiresAt: new Date(r.expires_at).toISOString(),
    createdByName: r.created_by_name, usedByName: r.used_by_name,
  }));
}

export async function revokeInvitation(db: Queryable, id: string): Promise<boolean> {
  const rows = await db.query(
    "update invitations set revoked_at = now() where id = $1 and used_at is null and revoked_at is null returning id",
    [id],
  );
  return rows.length > 0;
}

/** Checks a link without using it, so the sign-up page can show the right message. */
export async function peekInvitation(db: Queryable, token: string): Promise<{ role: Role } | null> {
  const rows = await db.query<{ role: Role }>(
    `select role from invitations
      where token_hash = $1 and used_at is null and revoked_at is null and expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export type AcceptResult =
  | { ok: true; token: string; expiresAt: Date; role: Role }
  | { ok: false; reason: "invalid_link" | "email_taken" };

/** Uses the invitation and creates the account in one transaction, so a link works exactly once. */
export async function acceptInvitation(
  db: Db,
  args: { token: string; name: string; email: string; password: string },
): Promise<AcceptResult> {
  const passwordHash = await hashPassword(args.password);
  try {
    return await db.transaction<AcceptResult>(async (tx) => {
      const claimed = await tx.query<{ id: string; role: Role }>(
        `update invitations set used_at = now()
          where token_hash = $1 and used_at is null and revoked_at is null and expires_at > now()
          returning id, role`,
        [hashToken(args.token)],
      );
      if (!claimed[0]) return { ok: false, reason: "invalid_link" };

      const users = await tx.query<{ id: string }>(
        "insert into users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id",
        [args.email, args.name, passwordHash, claimed[0].role],
      );
      await tx.query("update invitations set used_by = $2 where id = $1", [claimed[0].id, users[0].id]);
      const session = await createSession(tx, users[0].id);
      return { ok: true, token: session.token, expiresAt: session.expiresAt, role: claimed[0].role };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "email_taken" };
    throw error;
  }
}
