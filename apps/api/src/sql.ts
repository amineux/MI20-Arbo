import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import pg from "pg";
import { SCHEMA_SQL, SCHEMA_EXTRAS_SQL, SQLITE_PRAGMAS, extraColumns } from "./schema.js";

export type SqlParams = unknown[] | Record<string, unknown> | undefined;

export interface RunResult {
  lastInsertId: number;
  changes: number;
}

export interface SqlDatabase {
  dialect: "sqlite" | "postgres";
  all<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | undefined>;
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const PG_KEYWORDS = new Set(
  `
    SELECT INSERT UPDATE DELETE FROM WHERE AND OR NOT NULL AS ON JOIN LEFT RIGHT INNER OUTER
    CROSS FULL GROUP BY ORDER LIMIT OFFSET VALUES SET INTO TABLE CREATE INDEX UNIQUE PRIMARY
    KEY FOREIGN REFERENCES CASCADE DEFAULT COUNT SUM AVG MIN MAX COALESCE CAST TEXT INTEGER
    BOOLEAN IF EXISTS DROP ALTER ADD COLUMN CONSTRAINT CHECK IN IS BETWEEN LIKE COLLATE ASC
    DESC UNION ALL DISTINCT HAVING CASE WHEN THEN ELSE END TRUE FALSE RETURNING CONFLICT DO
    NOTHING EXCLUDED PRAGMA OF WITH RECURSIVE WINDOW OVER PARTITION FILTER DATETIME NOW
    CURRENT_TIMESTAMP IMMEDIATE BEGIN COMMIT ROLLBACK TRANSACTION REPLACE IGNORE AUTOINCREMENT
    GENERATED IDENTITY ALWAYS SERIAL BIGSERIAL VACUUM ANALYZE EXPLAIN PLAN USING MATCH NATURAL
    ISNULL NOTNULL ESCAPE COLLATE RESTRICT NO ACTION DEFERRABLE INITIALLY DEFERRED IMMEDIATE
    TEMP TEMPORARY VIEW TRIGGER PROCEDURE FUNCTION RETURNS LANGUAGE plpgsql REPLACE
    SMALLINT BIGINT NUMERIC REAL DOUBLE PRECISION VARCHAR CHAR BYTEA JSON JSONB TIMESTAMP
    TIMESTAMPTZ DATE TIME UUID BOOLEAN
  `
    .trim()
    .split(/\s+/)
    .filter(Boolean),
);

function quotePgIdentifiers(sql: string): string {
  return sql.replace(/"([^"]*)"|'([^']*)'|@\w+|:\w+|\$\d+|\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (all, _dq, _sq, ident) => {
    if (!ident) return all;
    if (PG_KEYWORDS.has(ident.toUpperCase())) return all;
    if (ident === ident.toLowerCase()) return ident;
    return `"${ident}"`;
  });
}

function toPgSql(sql: string): { text: string; returning: boolean } {
  let text = sql.trim();
  text = text.replace(/\bdatetime\s*\(\s*'now'\s*\)/gi, "NOW()");
  text = text.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
  const wasIgnore = /\bINSERT\s+INTO\b/i.test(text) && /INSERT OR IGNORE/i.test(sql);
  text = quotePgIdentifiers(text);
  if (wasIgnore && !/\bON\s+CONFLICT\b/i.test(text)) {
    text = text.replace(/;?\s*$/, "") + " ON CONFLICT DO NOTHING";
  }
  const isInsert = /^\s*INSERT\s+/i.test(text);
  const hasReturning = /\bRETURNING\b/i.test(text);
  if (isInsert && !hasReturning) {
    text = text.replace(/;?\s*$/, "") + " RETURNING *";
    return { text, returning: true };
  }
  return { text, returning: hasReturning };
}

function positionalize(
  sql: string,
  params: SqlParams,
  dialect: "sqlite" | "postgres",
): { text: string; values: unknown[] | Record<string, unknown> } {
  if (params === undefined || params === null) {
    return { text: dialect === "postgres" ? toPgSql(sql).text : sql, values: [] };
  }
  if (Array.isArray(params)) {
    if (dialect === "sqlite") return { text: sql, values: params };
    let n = 0;
    const { text } = toPgSql(sql.replace(/\?/g, () => `$${++n}`));
    return { text, values: params };
  }
  if (dialect === "sqlite") return { text: sql, values: params };
  const values: unknown[] = [];
  const replaced = sql.replace(/@(\w+)/g, (_, name: string) => {
    values.push(params[name]);
    return `$${values.length}`;
  });
  return { text: toPgSql(replaced.replace(/\?/g, () => `$${values.push(undefined) && values.length}`)).text, values };
}

function lastIdFromRow(row: Record<string, unknown> | undefined): number {
  if (!row) return 0;
  const v = row.Id ?? row.id;
  return v == null ? 0 : Number(v);
}

export class SqliteDatabase implements SqlDatabase {
  dialect = "sqlite" as const;
  private readonly raw: Database.Database;
  private chain: Promise<unknown> = Promise.resolve();
  private txDepth = 0;

  constructor(filePath: string) {
    if (filePath !== ":memory:") {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    this.raw = new Database(filePath);
    for (const pragma of SQLITE_PRAGMAS) this.raw.pragma(pragma);
  }

  private enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.txDepth > 0) {
      return Promise.resolve().then(fn);
    }
    const run = this.chain.then(fn, fn) as Promise<T>;
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async all<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]> {
    return this.enqueue(() => {
      const stmt = this.raw.prepare(sql);
      if (params === undefined) return stmt.all() as T[];
      if (Array.isArray(params)) return stmt.all(...params) as T[];
      return stmt.all(params) as T[];
    });
  }

  async get<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | undefined> {
    return this.enqueue(() => {
      const stmt = this.raw.prepare(sql);
      if (params === undefined) return stmt.get() as T | undefined;
      if (Array.isArray(params)) return stmt.get(...params) as T | undefined;
      return stmt.get(params) as T | undefined;
    });
  }

  async run(sql: string, params?: SqlParams): Promise<RunResult> {
    return this.enqueue(() => {
      const stmt = this.raw.prepare(sql);
      const info =
        params === undefined ? stmt.run() : Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
      return { lastInsertId: Number(info.lastInsertRowid), changes: info.changes };
    });
  }

  async exec(sql: string): Promise<void> {
    return this.enqueue(() => {
      this.raw.exec(sql);
    });
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      this.txDepth += 1;
      this.raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn();
        this.raw.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          this.raw.exec("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        this.txDepth -= 1;
      }
    });
  }

  async close(): Promise<void> {
    await this.enqueue(() => {
      this.raw.close();
    });
  }

  /** Used by migrate to inspect sqlite catalogs. */
  rawDb(): Database.Database {
    return this.raw;
  }
}

const pgTx = new AsyncLocalStorage<pg.PoolClient>();

export class PostgresDatabase implements SqlDatabase {
  dialect = "postgres" as const;
  constructor(private readonly pool: pg.Pool) {}

  private client(): pg.Pool | pg.PoolClient {
    return pgTx.getStore() ?? this.pool;
  }

  private async query(sql: string, params?: SqlParams): Promise<pg.QueryResult> {
    const { text, values } = positionalize(sql, params, "postgres");
    const client = this.client();
    return client.query(text, Array.isArray(values) ? values : []);
  }

  async all<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]> {
    const res = await this.query(sql, params);
    return res.rows as T[];
  }

  async get<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params);
    return rows[0];
  }

  async run(sql: string, params?: SqlParams): Promise<RunResult> {
    const res = await this.query(sql, params);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return { lastInsertId: lastIdFromRow(row), changes: res.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    const statements = splitSql(sql);
    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      if (/^\s*PRAGMA\b/i.test(stmt)) continue;
      const transformed = sqliteDdlToPostgres(stmt);
      if (!transformed.trim()) continue;
      await this.client().query(transformed);
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const existing = pgTx.getStore();
    if (existing) return fn();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await pgTx.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function splitSql(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sqliteDdlToPostgres(stmt: string): string {
  let s = stmt.trim();
  if (/^\s*PRAGMA\b/i.test(s)) return "";
  s = s.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY");
  s = s.replace(/\bAUTOINCREMENT\b/gi, "");
  s = s.replace(/COLLATE NOCASE/gi, "");
  s = s.replace(/\bINSERT OR IGNORE INTO\b/gi, "INSERT INTO");
  s = quotePgIdentifiers(s);
  if (/^\s*INSERT\s+INTO\b/i.test(s) && !/\bON\s+CONFLICT\b/i.test(s) && /INSERT INTO/i.test(stmt)) {
    // seed-time INSERT OR IGNORE converted above
    if (/INSERT OR IGNORE/i.test(stmt)) {
      s = s.replace(/;?\s*$/, "") + " ON CONFLICT DO NOTHING";
    }
  }
  return s;
}

export async function migrate(db: SqlDatabase): Promise<void> {
  await db.exec(SCHEMA_SQL);
  for (const col of extraColumns()) {
    await ensureColumn(db, col.table, col.name, col.ddl);
  }
  await db.exec(SCHEMA_EXTRAS_SQL);
}

async function ensureColumn(db: SqlDatabase, table: string, name: string, ddl: string): Promise<void> {
  if (db.dialect === "sqlite") {
    const sqlite = db as SqliteDatabase;
    const cols = sqlite
      .rawDb()
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (cols.some((c) => c.name === name)) return;
    sqlite.rawDb().exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    return;
  }
  await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${quotePgIdentifiers(ddl)}`);
}

export function dbPathFromEnv(): string {
  if (process.env.MI20_DB_PATH) return process.env.MI20_DB_PATH;
  return path.resolve(process.cwd(), "data/mi20.db");
}

export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export async function openDatabase(filePath?: string): Promise<SqlDatabase> {
  const url = databaseUrl();
  if (url && /^postgres(ql)?:\/\//i.test(url)) {
    const pool = new pg.Pool({ connectionString: url, max: 8 });
    const db = new PostgresDatabase(pool);
    await migrate(db);
    return db;
  }
  const sqlite = new SqliteDatabase(filePath ?? dbPathFromEnv());
  await migrate(sqlite);
  return sqlite;
}

/** Test helper: sqlite memory (no Postgres). */
export async function openMemoryDatabase(): Promise<SqlDatabase> {
  const sqlite = new SqliteDatabase(":memory:");
  await migrate(sqlite);
  return sqlite;
}
