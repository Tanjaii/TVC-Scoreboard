
import { getDatabasePool } from "../src/server/database.js";
import type { LiveMatchData } from "../src/data/liveMatch.js";
import { isLiveMatchData } from "../src/server/liveMatchValidation.js";

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Allow": "GET, PUT",
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
      return jsonResponse(
        { error: "Live match data is not configured." },
        503,
      );
    }

    return jsonResponse({ liveMatch: match });
  } catch (error) {
    console.error("Could not load live match data.", error);

    return jsonResponse(
      { error: "Live match data is temporarily unavailable." },
      503,
    );
  }
}

export async function PUT() {
  return jsonResponse(
    { error: "Score updates are currently disabled." },
    405,
  );
}
