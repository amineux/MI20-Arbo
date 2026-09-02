import { indexColumnsByHeader, normalizeHeader } from "./columns.js";
import { unpivotJalons } from "./jalon.js";
import { cellToText, parseLigne } from "./ligne.js";
import { matchLookupByNom, matchLookupDomaineChargeur, lookupTableKey } from "./lookup.js";
import { parseOuiNon } from "./oui-non.js";
import type {
  ImportColumn,
  LookupCatalog,
  PpdConfig,
  StagedDocument,
} from "./types.js";
import { DEFAULT_PPD_CONFIG, RAPIDE_FIELD_ALLOWLIST } from "./types.js";

export interface ParseWorkbookResult {
  mode: "full" | "rapide";
  headerRowIndex: number;
  headers: string[];
  rows: StagedDocument[];
  warnings: string[];
}

export function detectHeaderRow(
  sheet: unknown[][],
  config: PpdConfig = DEFAULT_PPD_CONFIG,
): { rowIndex: number; mode: "full" | "rapide" } | null {
  const full = normalizeHeader(config.firstColumnTitle);
  const rapide = normalizeHeader(config.firstColumnTitleRapide);
  const limit = Math.min(sheet.length, 100);
  for (let i = 0; i < limit; i++) {
    const first = normalizeHeader(cellToText(sheet[i]?.[0]));
    if (config.rapide && first === rapide) return { rowIndex: i, mode: "rapide" };
    if (!config.rapide && first === full) return { rowIndex: i, mode: "full" };
    if (first === full) return { rowIndex: i, mode: "full" };
    if (first === rapide) return { rowIndex: i, mode: "rapide" };
  }
  return null;
}

export function parsePpdSheet(
  sheet: unknown[][],
  columns: ImportColumn[],
  lookups: LookupCatalog,
  config: PpdConfig = DEFAULT_PPD_CONFIG,
): ParseWorkbookResult {
  const warnings: string[] = [];
  const detected = detectHeaderRow(sheet, config);
  if (!detected) {
    throw new Error(
      `En-tête PPD introuvable (attendu « ${config.firstColumnTitle} » ou « ${config.firstColumnTitleRapide} » en colonne A, 100 premières lignes).`,
    );
  }

  const headerRow = sheet[detected.rowIndex] ?? [];
  const headers = headerRow.map((c) => cellToText(c));
  const byHeader = indexColumnsByHeader(columns);
  const colIndex = new Map<ImportColumn, number>();

  headers.forEach((h, idx) => {
    const col = byHeader.get(normalizeHeader(h));
    if (col) colIndex.set(col, idx);
  });

  const missing = columns.filter((c) => {
    if (c.nature === "J") return false;
    if (detected.mode === "rapide" && !RAPIDE_FIELD_ALLOWLIST.has(c.documentField) && c.nature !== "LIGNE") {
      return false;
    }
    if (!c.toImport && detected.mode === "rapide") return false;
    return !colIndex.has(c);
  });
  if (missing.length && detected.mode === "full") {
    warnings.push(
      `Colonnes mapping absentes du classeur: ${missing.map((m) => m.ppdTitle).join("; ")}`,
    );
  }

  const rows: StagedDocument[] = [];
  for (let r = detected.rowIndex + 1; r < sheet.length; r++) {
    const dataRow = sheet[r] ?? [];
    if (dataRow.every((c) => cellToText(c) === "")) continue;

    const staged: StagedDocument = {
      ligneExcel: r + 1,
      groupeLigne: null,
      indiceLigne: "",
      fields: {},
      displayFields: {},
      jalons: [],
      errors: [],
      isNew: false,
    };

    const scope: { idPerimetre?: number | null; idDomaine?: number | null; idMetier?: number | null } = {};

    const ordered = [...columns].sort((a, b) => columnApplyRank(a) - columnApplyRank(b));

    for (const col of ordered) {
      if (col.nature === "J") continue;
      if (detected.mode === "rapide" && !RAPIDE_FIELD_ALLOWLIST.has(col.documentField) && col.nature !== "LIGNE") {
        continue;
      }
      if (!col.toImport && detected.mode === "full" && col.nature !== "LIGNE") {
        continue;
      }
      const idx = colIndex.get(col);
      if (idx === undefined) continue;
      const raw = dataRow[idx];
      const display = cellToText(raw);
      staged.displayFields[col.documentField] = display;

      try {
        applyColumn(col, raw, display, staged, lookups, scope);
      } catch (err) {
        staged.errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    staged.jalons = unpivotJalons(headerRow, dataRow, config);
    rows.push(staged);
  }

  return {
    mode: detected.mode,
    headerRowIndex: detected.rowIndex,
    headers,
    rows,
    warnings,
  };
}

function applyColumn(
  col: ImportColumn,
  raw: unknown,
  display: string,
  staged: StagedDocument,
  lookups: LookupCatalog,
  scope: { idPerimetre?: number | null; idDomaine?: number | null; idMetier?: number | null },
): void {
  switch (col.nature) {
    case "LIGNE": {
      const parsed = parseLigne(raw);
      if (!parsed) {
        throw new Error(
          `Le champ Num Liv. « ${display} » (ligne Excel ${staged.ligneExcel}) n'est pas une LIGNE valide (ex. 36 / 9351.3).`,
        );
      }
      staged.groupeLigne = parsed.groupeLigne;
      staged.indiceLigne = parsed.indiceLigne;
      staged.fields.GroupeLigne = parsed.groupeLigne;
      staged.fields.IndiceLigne = parsed.indiceLigne;
      return;
    }
    case "T":
    case "TITRE": {
      staged.fields[col.documentField] = display;
      return;
    }
    case "OUINON":
    case "AUTORISANT": {
      const flag = parseOuiNon(raw);
      staged.fields[col.documentField] = flag ?? false;
      return;
    }
    case "LDD": {
      if (!display) {
        staged.fields[col.documentField] = null;
        return;
      }
      const table = lookupTableKey(col.associatedTable);
      const rows = lookups[table] ?? lookups[table.toLowerCase()] ?? [];
      const hit = matchLookupByNom(display, rows);
      if (!hit) {
        throw new Error(
          `Le champ ${labelFor(col)} '${display}' doit être un des choix de la table ${table}`,
        );
      }
      staged.fields[col.documentField] = hit.id;
      return;
    }
    case "LDDDomaineChargeur": {
      if (!display) {
        staged.fields[col.documentField] = null;
        return;
      }
      const table = lookupTableKey(col.associatedTable);
      const rows = lookups[table] ?? lookups[table.toLowerCase()] ?? [];
      const hit = matchLookupDomaineChargeur(display, rows, scope);
      if (!hit) {
        throw new Error(
          `Le champ ${labelFor(col)} '${display}' doit être un des choix de la table ${table}`,
        );
      }
      staged.fields[col.documentField] = hit.id;
      if (col.documentField === "IdPerimetre") scope.idPerimetre = hit.id;
      if (col.documentField === "IdDomaineBord") scope.idDomaine = hit.id;
      if (col.documentField === "IdMetier") scope.idMetier = hit.id;
      if (col.documentField === "IdDomaineChargeur") {
        scope.idDomaine = hit.idDomaine ?? scope.idDomaine;
        scope.idMetier = hit.idMetier ?? scope.idMetier;
        scope.idPerimetre = hit.idPerimetre ?? scope.idPerimetre;
      }
      return;
    }
    default:
      return;
  }
}

function columnApplyRank(col: ImportColumn): number {
  if (col.nature === "LIGNE") return 0;
  if (col.documentField === "IdPerimetre") return 1;
  if (col.documentField === "IdMetier") return 2;
  if (col.documentField === "IdDomaineBord") return 3;
  if (col.nature === "LDDDomaineChargeur") return 4;
  if (col.nature === "LDD") return 5;
  return 6;
}

function labelFor(col: ImportColumn): string {
  return col.ppdTitle || col.documentField;
}
