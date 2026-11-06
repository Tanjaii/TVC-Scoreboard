import { z } from "zod";
import { getDb } from "../db";
import { matchSchema } from "../match";
import { createMatch, deleteMatch, getMatch, listMatches, saveMatch } from "../repo/matches";
import { listTeams } from "../repo/teams";
import { fail, isUuid, json, readJson, requireMutation, requireUser, safely } from "../http";

const STAFF = ["admin", "scorekeeper"] as const;

export const list = (req: Request) => safely(async () => {
  const gate = await requireUser(req, STAFF);
  if ("response" in gate) return gate.response;
  const db = getDb();
  return json({ matches: await listMatches(db), teams: await listTeams(db) });
});

export const create = (req: Request) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  const body = await readJson(req, matchSchema);
  if ("response" in body) return body.response;

  const result = await createMatch(getDb(), body.data, gate.user.id);
  if (result.ok) return json({ match: result.match }, 201);
  return result.reason === "another_live"
    ? fail(409, "Another match is already live. Finish it before starting this one.", { code: "another_live" })
    : fail(422, "That team does not exist.");
});

export const get = (req: Request, id: string) => safely(async () => {
  const gate = await requireUser(req, STAFF);
  if ("response" in gate) return gate.response;
  const match = isUuid(id) ? await getMatch(getDb(), id) : null;
  return match ? json({ match }) : fail(404, "Match not found.");
});

const saveSchema = z.strictObject({ version: z.int().min(1), match: matchSchema });

export const save = (req: Request, id: string) => safely(async () => {
  const gate = await requireMutation(req, STAFF);
  if ("response" in gate) return gate.response;
  if (!isUuid(id)) return fail(404, "Match not found.");
  const body = await readJson(req, saveSchema);
  if ("response" in body) return body.response;

  const result = await saveMatch(getDb(), {
    id, expectedVersion: body.data.version, input: body.data.match, userId: gate.user.id, role: gate.user.role,
  });
  if (result.ok) return json({ match: result.match });
  switch (result.reason) {
    case "not_found": return fail(404, "Match not found.");
    case "conflict":
      return fail(409, "This match was saved by someone else since you opened it.", { code: "conflict", match: result.match });
    case "forbidden": return fail(403, result.message);
    case "another_live":
      return fail(409, "Another match is already live. Finish it before starting this one.", { code: "another_live" });
    case "unknown_team": return fail(422, "That team does not exist.");
  }
});

export const remove = (req: Request, id: string) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  const ok = isUuid(id) && (await deleteMatch(getDb(), id));
  return ok ? json({ ok: true }) : fail(404, "Match not found.");
});
