import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function databasePath() {
  return resolve(process.env.DATABASE_PATH ?? "./data/totalk.sqlite");
}

export function avatarsDir() {
  return join(dirname(databasePath()), "avatars");
}

export function getDb() {
  if (db) return db;

  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // SQLite's built-in lower()/LIKE case-folding only covers ASCII, so
  // Cyrillic search (e.g. friend lookup) silently misses case variants.
  // Override lower() with a Unicode-aware implementation.
  sqlite.function("lower", { deterministic: true }, (value) =>
    typeof value === "string" ? value.toLowerCase() : value);
  db = drizzle(sqlite, { schema });
  return db;
}
