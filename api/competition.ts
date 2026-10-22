import { auth } from "../src/server/auth.js";
import { getDatabasePool } from "../src/server/database.js";
import type { CompetitionState } from "../src/data/competitionState.js";
import { isCompetitionState } from "../src/server/competitionValidation.js";

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export async function GET() {
  try {
    const result = await getDatabasePool().query<{ data: CompetitionState }>(
      "SELECT data FROM competition_state WHERE singleton_key = 1",
    );
    const competition = result.rows[0]?.data;

    if (!competition || !isCompetitionState(competition)) {
      console.error("Competition state is missing or invalid in the database.");
      return jsonResponse({ error: "Competition data is not configured." }, 503);
    }

    return jsonResponse({ competition });
  } catch (error) {
    console.error("Could not load competition data.", error);
    return jsonResponse({ error: "Competition data is temporarily unavailable." }, 503);
  }
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Requests must come from this site." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 262_144) {
    return jsonResponse({ error: "The request body is too large." }, 413);
  }

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return jsonResponse({ error: "Administrator sign-in is required." }, 401);
    }

    const role = session.user.role;
    const isAdmin = role === "admin" || (Array.isArray(role) && role.includes("admin"));
    if (!isAdmin) {
      return jsonResponse({ error: "Administrator access is required." }, 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "The request body must be valid JSON." }, 400);
    }

    if (!isCompetitionState(body)) {
      return jsonResponse({ error: "Competition data is invalid. Check match IDs, teams, dates, and set scores." }, 400);
    }

    const result = await getDatabasePool().query<{ data: CompetitionState }>(
      `UPDATE competition_state
       SET data = $1::jsonb, updated_at = now(), updated_by = $2
       WHERE singleton_key = 1
       RETURNING data`,
      [JSON.stringify(body), session.user.id],
    );
    const savedCompetition = result.rows[0]?.data;

    if (!savedCompetition) {
      console.error("Competition state is missing; apply migration 0002_competition_state.sql.");
      return jsonResponse({ error: "Competition data is not configured." }, 503);
    }

    return jsonResponse({ competition: savedCompetition });
  } catch (error) {
    console.error("Could not save competition data.", error);
    return jsonResponse({ error: "Competition data could not be saved." }, 503);
  }
}
