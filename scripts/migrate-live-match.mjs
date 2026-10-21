import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be configured before running the live match migration.");
}

const pool = new Pool({ connectionString, max: 1 });

try {
  const migration = await readFile(
    new URL("../db/migrations/0001_live_match_state.sql", import.meta.url),
    "utf8",
  );
  await pool.query(migration);
  console.log("Live match database migration applied.");
} catch (error) {
  console.error("Could not apply the live match database migration.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
