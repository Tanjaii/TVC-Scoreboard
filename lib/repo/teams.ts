import { z } from "zod";
import { isForeignKeyViolation, isUniqueViolation, type Queryable } from "../db";

export const teamSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  shortName: z.string().trim().max(12),
  logoUrl: z.string().trim().max(500).refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), {
    message: "Logo must be an https:// link or a path starting with /.",
  }),
  info: z.string().trim().max(2000),
});
export type TeamInput = z.infer<typeof teamSchema>;
export type Team = TeamInput & { id: string };

type TeamRow = { id: string; name: string; short_name: string; logo_url: string; info: string };
const toTeam = (r: TeamRow): Team => ({ id: r.id, name: r.name, shortName: r.short_name, logoUrl: r.logo_url, info: r.info });

export async function listTeams(db: Queryable): Promise<Team[]> {
  return (await db.query<TeamRow>("select id, name, short_name, logo_url, info from teams order by lower(name)")).map(toTeam);
}

export type TeamResult = { ok: true; team: Team } | { ok: false; reason: "duplicate" | "not_found" | "in_use" };

export async function createTeam(db: Queryable, input: TeamInput): Promise<TeamResult> {
  try {
    const rows = await db.query<TeamRow>(
      "insert into teams (name, short_name, logo_url, info) values ($1, $2, $3, $4) returning id, name, short_name, logo_url, info",
      [input.name, input.shortName, input.logoUrl, input.info],
    );
    return { ok: true, team: toTeam(rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

export async function updateTeam(db: Queryable, id: string, input: TeamInput): Promise<TeamResult> {
  try {
    const rows = await db.query<TeamRow>(
      `update teams set name = $2, short_name = $3, logo_url = $4, info = $5 where id = $1
       returning id, name, short_name, logo_url, info`,
      [id, input.name, input.shortName, input.logoUrl, input.info],
    );
    return rows[0] ? { ok: true, team: toTeam(rows[0]) } : { ok: false, reason: "not_found" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

export async function deleteTeam(db: Queryable, id: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use" }> {
  try {
    const rows = await db.query("delete from teams where id = $1 returning id", [id]);
    return rows[0] ? { ok: true } : { ok: false, reason: "not_found" };
  } catch (error) {
    if (isForeignKeyViolation(error)) return { ok: false, reason: "in_use" };
    throw error;
  }
}
