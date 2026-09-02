import * as XLSX from "xlsx";
import { canonicalHeader, indexColumnsByHeader, normalizeHeader } from "./columns.js";
import { jalonCodeFromHeader } from "./jalon.js";
import { cellToText } from "./ligne.js";
import { detectHeaderRow } from "./parse-workbook.js";
import { DEFAULT_PPD_CONFIG } from "./types.js";
import type { ImportColumn, PpdConfig } from "./types.js";

const RATP_MASK_NOTE =
  "Colonnes masquées pour export RATP (config [EXPORT_RATP] COLONNES_A_MASQUER)";

export function sheetFromMatrix(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

export function parseWorkbookToAoa(buffer: Buffer | ArrayBuffer | Uint8Array): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("Classeur Excel vide");
  const preferred =
    wb.SheetNames.find((n) => n.toUpperCase() === "PPD") ??
    wb.SheetNames.find((n) => n.toUpperCase().includes("PPD")) ??
    name;
  const sheet = wb.Sheets[preferred];
  if (!sheet) throw new Error("Feuille PPD introuvable");
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
}

export function buildPpdExportWorkbook(args: {
  columns: ImportColumn[];
  config?: PpdConfig;
  documents: Array<Record<string, unknown>>;
  jalonHeaders: string[];
  maskRatp?: boolean;
}): Buffer {
  const config = args.config ?? DEFAULT_PPD_CONFIG;
  const headers: string[] = [];
  const mapped = args.columns.filter((c) => c.nature !== "J");
  for (const col of mapped) {
    headers.push(col.ppdTitle);
  }
  while (headers.length < config.firstJalonCol - 1) headers.push("");
  headers.length = config.firstJalonCol - 1;
  for (let i = 0; i < config.jalonCount; i++) {
    headers.push(args.jalonHeaders[i] ?? `Jalon_${i + 1}`);
  }
  while (headers.length < config.firstJalonDateCol - 1) headers.push("");
  headers.length = config.firstJalonDateCol - 1;
  for (let i = 0; i < config.jalonCount; i++) {
    headers.push(`Date ${args.jalonHeaders[i] ?? i + 1}`);
  }

  const aoa: unknown[][] = [headers];
  for (const doc of args.documents) {
    const line: unknown[] = new Array(headers.length).fill("");
    mapped.forEach((col, idx) => {
      if (col.documentField === "GroupeLigne") {
        line[idx] = `${doc.GroupeLigne ?? ""}${doc.IndiceLigne ? ` / ${doc.IndiceLigne}` : ""}`;
      } else {
        line[idx] = doc[col.documentField] ?? "";
      }
    });
    const jalons = (doc.jalons as Array<{ nom: string; valeur: string; date: string | null }> | undefined) ?? [];
    for (let i = 0; i < config.jalonCount; i++) {
      const j = jalons[i];
      line[config.firstJalonCol - 1 + i] = j?.valeur ?? "";
      line[config.firstJalonDateCol - 1 + i] = j?.date ?? "";
    }
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (args.maskRatp) {
    for (const letter of config.ratpMaskedColumns) {
      hideColumn(ws, letter);
    }
    XLSX.utils.sheet_add_aoa(ws, [[`${RATP_MASK_NOTE}: ${config.ratpMaskedColumns.join(", ")}`]], {
      origin: { r: aoa.length + 1, c: 0 },
    });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PPD");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function hideColumn(ws: XLSX.WorkSheet, letter: string): void {
  const idx = XLSX.utils.decode_col(letter);
  if (!ws["!cols"]) ws["!cols"] = [];
  const cols = ws["!cols"];
  while (cols.length <= idx) cols.push({});
  cols[idx] = { ...(cols[idx] ?? {}), hidden: true };
}

export function excelColumnLetter(index1Based: number): string {
  return XLSX.utils.encode_col(index1Based - 1);
}

/** Fill official PPD_Template.xlsx (or Copie_de_PPD_Template.xlsx) instead of inventing a workbook. */
export function fillOfficialPpdTemplate(args: {
  templateBuffer: Buffer;
  documents: Array<Record<string, unknown>>;
  columns: ImportColumn[];
  config?: PpdConfig;
  maskRatp?: boolean;
}): Buffer {
  const config = args.config ?? DEFAULT_PPD_CONFIG;
  const wb = XLSX.read(args.templateBuffer, { type: "buffer", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => n.toUpperCase() === "PPD") ??
    wb.SheetNames.find((n) => n.toUpperCase().includes("PPD")) ??
    wb.SheetNames[0];
  if (!sheetName) throw new Error("Feuille PPD introuvable dans le template officiel");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("Feuille PPD introuvable dans le template officiel");
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const detected = detectHeaderRow(aoa, { ...config, rapide: false });
  if (!detected) {
    throw new Error("En-tête Num Liv. introuvable dans le template PPD officiel");
  }
  const headerRow = aoa[detected.rowIndex] ?? [];
  const byHeader = indexColumnsByHeader(args.columns);
  const kept = aoa.slice(0, detected.rowIndex + 1);

  for (const doc of args.documents) {
    const line: unknown[] = new Array(Math.max(headerRow.length, config.lastPpdCol)).fill("");
    headerRow.forEach((h, idx) => {
      const title = cellToText(h);
      if (!title) return;
      const col = byHeader.get(canonicalHeader(title)) ?? byHeader.get(normalizeHeader(title));
      if (!col || col.nature === "J") return;
      if (col.nature === "LIGNE" || col.documentField === "GroupeLigne") {
        line[idx] = `${doc.GroupeLigne ?? ""}${doc.IndiceLigne ? ` / ${doc.IndiceLigne}` : ""}`;
        return;
      }
      line[idx] = doc[col.documentField] ?? "";
    });
    const jalons = (doc.jalons as Array<{ nom: string; valeur: string; date: string | null }> | undefined) ?? [];
    for (let i = 0; i < config.jalonCount; i++) {
      const header = jalonCodeFromHeader(cellToText(headerRow[config.firstJalonCol - 1 + i]));
      const match =
        jalons.find((j) => jalonCodeFromHeader(j.nom).toUpperCase() === header.toUpperCase()) ?? jalons[i];
      line[config.firstJalonCol - 1 + i] = match?.valeur ?? "";
      line[config.firstJalonDateCol - 1 + i] = match?.date ?? "";
    }
    kept.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(kept);
  if (args.maskRatp) {
    for (const letter of config.ratpMaskedColumns) hideColumn(ws, letter);
    XLSX.utils.sheet_add_aoa(ws, [[`${RATP_MASK_NOTE}: ${config.ratpMaskedColumns.join(", ")}`]], {
      origin: { r: kept.length + 1, c: 0 },
    });
  }
  wb.Sheets[sheetName] = ws;
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export { cellToText };
