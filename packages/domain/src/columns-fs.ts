import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseImportColumnsCsv } from "./columns.js";
import type { ImportColumn } from "./types.js";

export function loadBundledImportColumns(): ImportColumn[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();
  const candidates = [
    join(here, "../data/import_columns.csv"),
    join(here, "../../data/import_columns.csv"),
    join(here, "../../../docs/handoff/import_columns.csv"),
    join(cwd, "packages/domain/data/import_columns.csv"),
    join(cwd, "../../packages/domain/data/import_columns.csv"),
    join(cwd, "docs/handoff/import_columns.csv"),
    join(cwd, "../../docs/handoff/import_columns.csv"),
  ];
  for (const path of candidates) {
    try {
      return parseImportColumnsCsv(readFileSync(path, "utf8"));
    } catch {
      /* try next */
    }
  }
  throw new Error("Could not load import_columns.csv");
}
