import { auth } from "../src/server/auth.js";
import { getDatabasePool } from "../src/server/database.js";
import type { LiveMatchData } from "../src/data/liveMatch.js";
import { isLiveMatchData } from "../src/server/liveMatchValidation.js";

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

export async function GET() {
  try {
    const result = await getDatabasePool().query<{ data: LiveMatchData }>(
      "SELECT data FROM live_match_state WHERE singleton_key = 1",
    );
    const match = result.rows[0]?.data;

    if (!match || !isLiveMatchData(match)) {
      console.error("Live match state is missing or invalid in the database.");
      return jsonResponse({ error: "Live match data is not configured." }, 503);
    }

    return jsonResponse({ liveMatch: match });
  } catch (error) {
    console.error("Could not load live match data.", error);
    return jsonResponse({ error: "Live match data is temporarily unavailable." }, 503);
  }
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Requests must come from this site." }, 403);
  }

  if (Number(request.headers.get("content-length") ?? 0) > 16_384) {
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

    if (!isLiveMatchData(body)) {
      return jsonResponse({ error: "The live match data is invalid." }, 400);
    }

    const result = await getDatabasePool().query<{ data: LiveMatchData }>(
      `UPDATE live_match_state
       SET data = $1::jsonb, updated_at = now(), updated_by = $2
       WHERE singleton_key = 1
       RETURNING data`,
      [JSON.stringify(body), session.user.id],
    );

    const savedMatch = result.rows[0]?.data;
    if (!savedMatch) {
      console.error("Live match state is missing; apply the live match database migration.");
      return jsonResponse({ error: "Live match data is not configured." }, 503);
    }

    return jsonResponse({ liveMatch: savedMatch });
  } catch (error) {
    console.error("Could not save live match data.", error);
    return jsonResponse({ error: "Live match data could not be saved." }, 503);
  }
}
