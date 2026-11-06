import { getDb } from "../db";
import { createTeam, deleteTeam, listTeams, teamSchema, updateTeam } from "../repo/teams";
import { fail, isUuid, json, readJson, requireMutation, requireUser, safely } from "../http";

export const list = (req: Request) => safely(async () => {
  const gate = await requireUser(req, ["admin", "scorekeeper"]);
  if ("response" in gate) return gate.response;
  return json({ teams: await listTeams(getDb()) });
});

export const create = (req: Request) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  const body = await readJson(req, teamSchema);
  if ("response" in body) return body.response;
  const result = await createTeam(getDb(), body.data);
  return result.ok ? json({ team: result.team }, 201) : fail(409, "A team with that name already exists.");
});

export const update = (req: Request, id: string) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  if (!isUuid(id)) return fail(404, "Team not found.");
  const body = await readJson(req, teamSchema);
  if ("response" in body) return body.response;
  const result = await updateTeam(getDb(), id, body.data);
  if (result.ok) return json({ team: result.team });
  return result.reason === "duplicate" ? fail(409, "A team with that name already exists.") : fail(404, "Team not found.");
});

export const remove = (req: Request, id: string) => safely(async () => {
  const gate = await requireMutation(req, ["admin"]);
  if ("response" in gate) return gate.response;
  if (!isUuid(id)) return fail(404, "Team not found.");
  const result = await deleteTeam(getDb(), id);
  if (result.ok) return json({ ok: true });
  return result.reason === "in_use"
    ? fail(409, "This team is used by a match. Remove or change those matches first.")
    : fail(404, "Team not found.");
});
