import { z } from "zod";
import { getDb } from "../db";
import { createInvitation, listInvitations, revokeInvitation } from "../repo/invitations";
import { fail, isUuid, json, readJson, requireMutation, requireUser, safely } from "../http";

export const list = (req: Request) => safely(async () => {
  const gate = await requireUser(req, ["admin"]);
  if ("response" in gate) return gate.response;
  return json({ invitations: await listInvitations(getDb()) });
});

const createSchema = z.strictObject({ role: z.enum(["admin", "scorekeeper"]), note: z.string().trim().max(80) });

/** The link is returned once, here. Only its hash is stored, so it cannot be shown again. */
export const create = (req: Request) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  const body = await readJson(req, createSchema);
  if ("response" in body) return body.response;

  const made = await createInvitation(getDb(), { ...body.data, createdBy: gate.user.id });
  return json({ id: made.id, expiresAt: made.expiresAt, path: `/invite/${made.token}` }, 201);
});

export const revoke = (req: Request, id: string) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  const ok = isUuid(id) && (await revokeInvitation(getDb(), id));
  return ok ? json({ ok: true }) : fail(404, "That invitation is not pending.");
});
