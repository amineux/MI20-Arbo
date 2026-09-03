import * as XLSX from "xlsx";
import { canonicalHeader, indexColumnsByHeader, normalizeHeader } from "./columns.js";
import { jalonCodeFromHeader } from "./jalon.js";
import { cellToText, parseLigne } from "./ligne.js";
import { detectFaHeaderRow } from "./parse-fa.js";
import { detectHeaderRow } from "./parse-workbook.js";
import { DEFAULT_PPD_CONFIG } from "./types.js";
import type { ImportColumn, PpdConfig } from "./types.js";

const RATP_MASK_NOTE =
  "Colonnes masquées pour export RATP (config [EXPORT_RATP] COLONNES_A_MASQUER)";

export function sheetFromMatrix(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

function toUint8(data: Buffer | ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

function workbookFromBytes(data: Buffer | ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(toUint8(data), { type: "array", cellDates: true });
}

function writeXlsxBuffer(wb: XLSX.WorkBook): Buffer {
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  if (typeof Buffer !== "undefined") return Buffer.from(arr);
  return arr as unknown as Buffer;
}

function sheetToAoa(wb: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("Feuille Excel introuvable");
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
}

function countPlausibleLigneRows(aoa: unknown[][], headerRowIndex: number): number {
  const header = aoa[headerRowIndex] ?? [];
  let ligneIdx = header.findIndex((h) => canonicalHeader(cellToText(h)) === "num liv.");
  if (ligneIdx < 0) ligneIdx = 0;
  let n = 0;
  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    if (parseLigne(row[ligneIdx] ?? row[0])) n++;
  }
  return n;
}

function scorePpdSheet(name: string, aoa: unknown[][]): number {
  const detected = detectHeaderRow(aoa);
  if (!detected) return -1;
  const uname = name.toUpperCase();
  const lignes = countPlausibleLigneRows(aoa, detected.rowIndex);
  let nameBonus = 0;
  if (uname === "PPD") nameBonus = 100;
  else if (uname.includes("PPD")) nameBonus = 40;
  return lignes * 1000 + nameBonus;
}

function scoreFaSheet(name: string, aoa: unknown[][]): number {
  const headerRowIndex = detectFaHeaderRow(aoa);
  if (headerRowIndex == null) return -1;
  const uname = name.toUpperCase();
  const lignes = countPlausibleLigneRows(aoa, headerRowIndex);
  let nameBonus = 0;
  if (uname.includes("FA") || uname.includes("RETOUR") || uname.includes("AVIS")) nameBonus = 80;
  return lignes * 1000 + nameBonus;
}

function isSidecarSheet(name: string): boolean {
  const u = name.toUpperCase();
  if (u === "PPD") return false;
  return (
    /BILAN|INDICAT|KPI|PLANNING|\bENVOI|\bRAM\b/.test(u) ||
    /^JD[\d.]/.test(u)
  );
}

function pickBestSheet(
  sheets: Array<{ name: string; aoa: unknown[][] }>,
  scoreFn: (name: string, aoa: unknown[][]) => number,
): { name: string; aoa: unknown[][] } | null {
  let best: { name: string; aoa: unknown[][]; score: number } | null = null;
  for (const s of sheets) {
    const score = scoreFn(s.name, s.aoa);
    if (score < 0) continue;
    if (!best || score > best.score) best = { ...s, score };
  }
  return best;
}

function pickPpdSheet(sheets: Array<{ name: string; aoa: unknown[][] }>): { name: string; aoa: unknown[][] } | null {
  const namedPpd = sheets.find((s) => s.name.toUpperCase() === "PPD" && detectHeaderRow(s.aoa));
  const others = sheets.filter((s) => s.name.toUpperCase() !== "PPD" && !isSidecarSheet(s.name));
  const bestOther = pickBestSheet(others, scorePpdSheet);
  if (namedPpd) {
    const det = detectHeaderRow(namedPpd.aoa);
    const lignes = det ? countPlausibleLigneRows(namedPpd.aoa, det.rowIndex) : 0;
    if (lignes > 0) return namedPpd;
    const otherLignes = bestOther ? scorePpdSheet(bestOther.name, bestOther.aoa) : -1;
    if (otherLignes >= 1000) return bestOther;
    return namedPpd;
  }
  return bestOther ?? pickBestSheet(sheets, scorePpdSheet);
}

/**
 * Read a workbook into a matrix. Real PPD/FA files often have a cover or KPI
 * sheet first — pick the sheet that actually has Num Liv. / Nr Livrable /
 * NumLivrable and the most plausible data rows, not merely the first sheet
 * whose name contains "PPD".
 */
export function parseWorkbookToAoa(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  preferredSheet?: string,
): unknown[][] {
  const wb = workbookFromBytes(buffer);
  const names = wb.SheetNames.filter((n) => Boolean(wb.Sheets[n]));
  if (!names.length) throw new Error("Classeur Excel vide");

  const cache = new Map<string, unknown[][]>();
  const getAoa = (name: string) => {
    const hit = cache.get(name);
    if (hit) return hit;
    const aoa = sheetToAoa(wb, name);
    cache.set(name, aoa);
    return aoa;
  };

  const want = preferredSheet?.trim().toUpperCase();
  const wantFa = Boolean(want && (want.includes("FA") || want.includes("RETOUR") || want.includes("AVIS")));

  const scan = new Set<string>();
  names.slice(0, 3).forEach((n) => scan.add(n));
  for (const n of names) {
    const u = n.toUpperCase();
    if (
      u === "PPD" ||
      u.includes("PPD") ||
      u.includes("FA") ||
      u.includes("RETOUR") ||
      u.includes("IMPORT") ||
      u.includes("LIVR") ||
      u.includes("AVIS")
    ) {
      scan.add(n);
    }
    if (want && u.includes(want)) scan.add(n);
  }

  const sheets = [...scan].map((name) => ({ name, aoa: getAoa(name) }));

  if (want) {
    const named =
      sheets.find((s) => s.name.toUpperCase() === want) ??
      sheets.find((s) => s.name.toUpperCase().includes(want));
    if (named) {
      if (wantFa && detectFaHeaderRow(named.aoa) != null) return named.aoa;
      if (!wantFa && detectHeaderRow(named.aoa)) return named.aoa;
    }
  }

  if (wantFa) {
    const fa = pickBestSheet(sheets, scoreFaSheet);
    if (fa) return fa.aoa;
  }

  const ppd = pickPpdSheet(sheets);
  if (ppd) return ppd.aoa;
  const fa = pickBestSheet(sheets, scoreFaSheet);
  if (fa) return fa.aoa;

  return getAoa(names[0] ?? "");
}

export function writeAoaWorkbook(aoa: unknown[][], sheetName = "Sheet1"): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromMatrix(aoa), sheetName);
  return writeXlsxBuffer(wb);
}

export function writeMultiSheetWorkbook(sheets: Array<{ name: string; aoa: unknown[][] }>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, sheetFromMatrix(s.aoa), s.name.slice(0, 31) || "Sheet");
  }
  return writeXlsxBuffer(wb);
}

/** Build a filled full-mode PPD matrix from an official template header row. */
export function buildSyntheticFullPpdAoa(headers: string[], count: number): unknown[][] {
  const ligneIdx = Math.max(
    0,
    headers.findIndex((h) => canonicalHeader(h) === "num liv."),
  );
  const titreIdx = headers.findIndex((h) => {
    const n = normalizeHeader(h);
    return n.includes("titre du document") || n === "titre";
  });
  const langueIdx = headers.findIndex((h) => normalizeHeader(h) === "langue");
  const fournIdx = headers.findIndex((h) => normalizeHeader(h) === "fournisseur");
  const jd1Idx = headers.findIndex((h) => jalonCodeFromHeader(cellToText(h)).toUpperCase() === "JD1");
  const rows: unknown[][] = [headers];
  for (let i = 0; i < count; i++) {
    const line = new Array(headers.length).fill("");
    line[ligneIdx] = `70 / ${i + 1}`;
    if (titreIdx >= 0) line[titreIdx] = `PPD COMPLET DEMO ${i + 1}`;
    if (langueIdx >= 0) line[langueIdx] = "FR";
    if (fournIdx >= 0) line[fournIdx] = "CAF";
    if (jd1Idx >= 0) line[jd1Idx] = "FD";
    rows.push(line);
  }
  return rows;
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
  return writeXlsxBuffer(wb);
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
  templateBuffer: Buffer | ArrayBuffer | Uint8Array;
  documents: Array<Record<string, unknown>>;
  columns: ImportColumn[];
  config?: PpdConfig;
  maskRatp?: boolean;
}): Buffer {
  const config = args.config ?? DEFAULT_PPD_CONFIG;
  const wb = workbookFromBytes(args.templateBuffer);
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
  return writeXlsxBuffer(wb);
}

export { cellToText };
