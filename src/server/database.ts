import { Pool } from "@neondatabase/serverless";

let pool: Pool | undefined;

export function getDatabasePool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL must be configured for the backend.");
    }

    pool = new Pool({ connectionString, max: 1 });
  }

  return pool;
}
