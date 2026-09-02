import { cellToText } from "./ligne.js";
import type { JalonDef, JalonSlot, PpdConfig } from "./types.js";
import { DEFAULT_PPD_CONFIG, JALON_SLOT_COUNT } from "./types.js";

function excelSerialToIso(value: number): string {
  const utc = Date.UTC(1899, 11, 30) + Math.round(value * 86400000);
  const d = new Date(utc);
  return d.toISOString().slice(0, 10);
}

export function cellToDateIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 80000) return excelSerialToIso(value);
  }
  const text = cellToText(value);
  if (!text) return null;
  const fr = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (fr) {
    const dd = (fr[1] ?? "").padStart(2, "0");
    const mm = (fr[2] ?? "").padStart(2, "0");
    let yyyy = fr[3] ?? "";
    if (yyyy.length === 2) yyyy = Number(yyyy) > 50 ? `19${yyyy}` : `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return text.slice(0, 10);
  return text;
}

/**
 * Unpivot Excel jalon range (cols 44–66 names/values, 67–89 dates, nbJalonsPPD=23)
 * into Jalon_*_1..24 slots used by import_raw / programmation_jalon.
 *
 * When the header row carries jalon codes (JS0, JD1, …), those become Jalon_Nom_n
 * and the cell is Jalon_Valeur_n. Empty slots are omitted from the returned list
 * but keep their 1-based index for round-trip to import_raw.
 */
export function unpivotJalons(
  headerRow: unknown[],
  dataRow: unknown[],
  config: PpdConfig = DEFAULT_PPD_CONFIG,
): JalonSlot[] {
  const slots: JalonSlot[] = [];
  const count = Math.min(config.jalonCount, JALON_SLOT_COUNT);
  for (let i = 0; i < count; i++) {
    const valueCol = config.firstJalonCol - 1 + i;
    const dateCol = config.firstJalonDateCol - 1 + i;
    const header = cellToText(headerRow[valueCol]);
    const valeur = cellToText(dataRow[valueCol]);
    const date = cellToDateIso(dataRow[dateCol]);
    if (!header && !valeur && !date) continue;
    const estPrevisionnel = !valeur && !!date;
    slots.push({
      index: i + 1,
      nom: header,
      valeur,
      date,
      estPrevisionnel,
    });
  }
  return slots;
}

export function matchJalonDef(slot: JalonSlot, jalons: JalonDef[]): JalonDef | undefined {
  const candidates = [slot.nom, slot.nom.split(/\s+/)[0] ?? ""].filter(Boolean);
  const upper = (s: string) => s.trim().toUpperCase();
  for (const c of candidates) {
    const hit = jalons.find(
      (j) => upper(j.code) === upper(c) || upper(j.nom) === upper(c),
    );
    if (hit) return hit;
  }
  return undefined;
}

export function jalonsToRawFields(slots: JalonSlot[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 1; i <= JALON_SLOT_COUNT; i++) {
    const slot = slots.find((s) => s.index === i);
    out[`Jalon_Nom_${i}`] = slot?.nom ?? null;
    out[`Jalon_Valeur_${i}`] = slot?.valeur ?? null;
    out[`Jalon_Date_${i}`] = slot?.date ?? null;
    out[`Jalon_EstPrevisionnel_${i}`] = slot?.estPrevisionnel ?? false;
  }
  return out;
}
