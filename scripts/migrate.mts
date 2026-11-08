import { readFileSync } from "node:fs";
import { getDb } from "../lib/db";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await getDb().query(schema);
console.log("Database schema is up to date.");
process.exit(0);
