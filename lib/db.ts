import { Pool } from "@neondatabase/serverless";

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  /** Runs fn inside one transaction; any thrown error rolls everything back. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

const globalForDb = globalThis as unknown as { __tvcDb?: Db };

/** Tests (and nothing else) swap the database. */
export function setDb(db: Db | undefined): void {
  globalForDb.__tvcDb = db;
}

export function getDb(): Db {
  if (globalForDb.__tvcDb) return globalForDb.__tvcDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const pool = new Pool({ connectionString, max: 1 });
  const db: Db = {
    query: async (text, params) => (await pool.query(text, params as unknown[])).rows,
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async (text, params) => (await client.query(text, params as unknown[])).rows,
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
  globalForDb.__tvcDb = db;
  return db;
}

/** Postgres unique-violation helper. */
export function isUniqueViolation(error: unknown, constraintOrIndex?: string): boolean {
  const e = error as { code?: string; constraint?: string; message?: string };
  if (e?.code !== "23505") return false;
  return !constraintOrIndex || e.constraint === constraintOrIndex || Boolean(e.message?.includes(constraintOrIndex));
}

/** 23503 = foreign key violation; 23001 = the same thing reported for an explicit ON DELETE RESTRICT. */
export function isForeignKeyViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "23503" || code === "23001";
}
