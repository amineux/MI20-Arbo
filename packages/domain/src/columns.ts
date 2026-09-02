import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ColumnNature, ImportColumn } from "./types.js";

const NATURES = new Set<ColumnNature>([
  "T",
  "TITRE",
  "LIGNE",
  "LDD",
  "LDDDomaineChargeur",
  "OUINON",
  "J",
  "AUTORISANT",
]);

export function parseImportColumnsCsv(csv: string): ImportColumn[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: ImportColumn[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseCsvLine(lines[i] ?? "");
    if (parsed.length < 7) continue;
    const nature = (parsed[3] ?? "").trim() as ColumnNature;
    if (!NATURES.has(nature)) {
      throw new Error(`Unknown import_columns nature '${nature}' on line ${i + 1}`);
    }
    rows.push({
      id: Number(parsed[0]),
      documentField: unquote(parsed[1] ?? ""),
      ppdTitle: unquote(parsed[2] ?? ""),
      nature,
      associatedTable: unquote(parsed[4] ?? "") || null,
      toImport: parsed[5] === "1" || parsed[5]?.toLowerCase() === "true",
      destTable: unquote(parsed[6] ?? "") || "document",
    });
  }
  return rows;
}

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

export function normalizeHeader(title: string): string {
  return title
    .replace(/\u00a0/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const HEADER_ALIASES: Record<string, string> = {
  "n° de ligne": "num liv.",
  "numero de ligne": "num liv.",
  "nr livrable": "num liv.",
  "mod ele cao": "modele cao",
};

export function canonicalHeader(title: string): string {
  const n = normalizeHeader(title);
  return HEADER_ALIASES[n] ?? n;
}

export function indexColumnsByHeader(
  columns: ImportColumn[],
): Map<string, ImportColumn> {
  const map = new Map<string, ImportColumn>();
  for (const col of columns) {
    const key = canonicalHeader(col.ppdTitle);
    map.set(key, col);
    map.set(normalizeHeader(col.ppdTitle), col);
  }
  return map;
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/""/g, '"');
  }
  return v;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
