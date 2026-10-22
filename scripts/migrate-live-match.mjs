import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be configured before running database migrations.");
}

const pool = new Pool({ connectionString, max: 1 });
const migrations = [
  { path: "../db/migrations/0001_live_match_state.sql", label: "Live match state" },
  { path: "../db/migrations/0002_competition_state.sql", label: "Competition state" },
];

try {
  for (const migrationInfo of migrations) {
    const migration = await readFile(new URL(migrationInfo.path, import.meta.url), "utf8");
    await pool.query(migration);
    console.log(`Applied migration: ${migrationInfo.label}`);
  }
} catch (error) {
  console.error("Could not apply database migrations.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
