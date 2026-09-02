import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";

export function openDatabase(filePath: string): Database.Database {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

export function dbPathFromEnv(): string {
  if (process.env.MI20_DB_PATH) return process.env.MI20_DB_PATH;
  return path.resolve(process.cwd(), "data/mi20.db");
}
