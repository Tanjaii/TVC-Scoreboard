import { getDb } from "../db";
import { buildPublicSnapshot } from "../public";
import { listMatches } from "../repo/matches";
import { listTeams } from "../repo/teams";
import { fail, json } from "../http";

/** Public, read-only. Builds the snapshot from saved data only. */
export async function snapshot(): Promise<Response> {
  try {
    const db = getDb();
    return json(buildPublicSnapshot(await listMatches(db), await listTeams(db)));
  } catch (error) {
    console.error("Public snapshot failed.", error);
    return fail(503, "The scoreboard is temporarily unavailable.");
  }
}
