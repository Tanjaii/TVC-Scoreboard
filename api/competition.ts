import { getDatabasePool } from "../src/server/database.js";
import type { CompetitionState } from "../src/data/competitionState.js";
import { isCompetitionState } from "../src/server/competitionValidation.js";

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
    const result = await getDatabasePool().query<{ data: CompetitionState }>(
      "SELECT data FROM competition_state WHERE singleton_key = 1",
    );

    const competition = result.rows[0]?.data;

    if (!competition || !isCompetitionState(competition)) {
      console.error("Competition state is missing or invalid in the database.");

      return jsonResponse(
        { error: "Competition data is not configured." },
        503,
      );
    }

    return jsonResponse({ competition });
  } catch (error) {
    console.error("Could not load competition data.", error);

    return jsonResponse(
      { error: "Competition data is temporarily unavailable." },
      503,
    );
  }
}

export async function PUT() {
  return jsonResponse(
    { error: "Competition updates are currently disabled." },
    405,
  );
}
