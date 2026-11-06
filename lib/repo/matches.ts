import { isForeignKeyViolation, isUniqueViolation, type Db, type Queryable } from "../db";
import type { Role } from "../auth/session";
import { authorizeMatchChange } from "../permissions";
import { matchSchema, toInput, type MatchInput, type MatchRecord } from "../match";

type MatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  stage: string;
  scheduled_at: Date | string | null;
  status: MatchInput["status"];
  sets: MatchInput["sets"];
  current_set: MatchInput["currentSet"];
  stats: MatchInput["stats"];
  is_broadcasting: boolean;
  version: number;
  updated_at: Date | string;
  updated_by_name: string | null;
};

const SELECT = `
  select m.id, m.home_team_id, m.away_team_id, m.stage, m.scheduled_at, m.status, m.sets, m.current_set,
         m.stats, m.is_broadcasting, m.version, m.updated_at, u.name as updated_by_name
    from matches m left join users u on u.id = m.updated_by`;

const iso = (v: Date | string) => new Date(v).toISOString();

function toRecord(r: MatchRow): MatchRecord {
  return {
    id: r.id,
    version: r.version,
    updatedAt: iso(r.updated_at),
    updatedByName: r.updated_by_name,
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    stage: r.stage,
    scheduledAt: r.scheduled_at ? iso(r.scheduled_at) : null,
    status: r.status,
    sets: r.sets,
    currentSet: r.current_set,
    stats: r.stats,
    isBroadcasting: r.is_broadcasting,
  };
}

export async function listMatches(db: Queryable): Promise<MatchRecord[]> {
  const rows = await db.query<MatchRow>(`${SELECT} order by m.scheduled_at nulls last, m.created_at`);
  return rows.map(toRecord);
}

export async function getMatch(db: Queryable, id: string): Promise<MatchRecord | null> {
  const rows = await db.query<MatchRow>(`${SELECT} where m.id = $1`, [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

export type CreateResult =
  | { ok: true; match: MatchRecord }
  | { ok: false; reason: "unknown_team" | "another_live" };

const INSERT = `insert into matches
  (home_team_id, away_team_id, stage, scheduled_at, status, sets, current_set, stats, is_broadcasting, updated_by)
  values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10) returning id`;

const params = (m: MatchInput) => [
  m.homeTeamId,
  m.awayTeamId,
  m.stage,
  m.scheduledAt,
  m.status,
  JSON.stringify(m.sets),
  m.currentSet ? JSON.stringify(m.currentSet) : null,
  JSON.stringify(m.stats),
  m.isBroadcasting,
];

export async function createMatch(db: Queryable, input: MatchInput, userId: string): Promise<CreateResult> {
  try {
    const rows = await db.query<{ id: string }>(INSERT, [...params(input), userId]);
    return { ok: true, match: (await getMatch(db, rows[0].id))! };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "another_live" };
    if (isForeignKeyViolation(error)) return { ok: false, reason: "unknown_team" };
    throw error;
  }
}

export type SaveResult =
  | { ok: true; match: MatchRecord }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; match: MatchRecord }
  | { ok: false; reason: "forbidden"; message: string }
  | { ok: false; reason: "another_live" | "unknown_team" };

/**
 * Saves an edited match only if nobody saved it since the editor loaded it.
 * The row is locked while we compare the version, check the role's permissions and write.
 */
export async function saveMatch(
  db: Db,
  args: { id: string; expectedVersion: number; input: MatchInput; userId: string; role: Role },
): Promise<SaveResult> {
  try {
    return await db.transaction<SaveResult>(async (tx) => {
      const locked = await tx.query("select id from matches where id = $1 for update", [args.id]);
      if (!locked[0]) return { ok: false, reason: "not_found" };

      const current = (await getMatch(tx, args.id))!;
      if (current.version !== args.expectedVersion) return { ok: false, reason: "conflict", match: current };

      const decision = authorizeMatchChange(args.role, toInput(current), args.input);
      if (!decision.ok) return { ok: false, reason: "forbidden", message: decision.message };

      const m = args.input;
      await tx.query(
        `update matches set home_team_id = $2, away_team_id = $3, stage = $4, scheduled_at = $5, status = $6,
                sets = $7::jsonb, current_set = $8::jsonb, stats = $9::jsonb, is_broadcasting = $10,
                version = version + 1, updated_by = $11, updated_at = now()
          where id = $1`,
        [args.id, ...params(m).slice(0), args.userId],
      );
      return { ok: true, match: (await getMatch(tx, args.id))! };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "another_live" };
    if (isForeignKeyViolation(error)) return { ok: false, reason: "unknown_team" };
    throw error;
  }
}

export async function deleteMatch(db: Queryable, id: string): Promise<boolean> {
  return (await db.query("delete from matches where id = $1 returning id", [id])).length > 0;
}

export { matchSchema };
