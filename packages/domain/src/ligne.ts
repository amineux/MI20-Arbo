/**
 * Parse PPD "Num Liv." / LIGNE cells into GroupeLigne + IndiceLigne.
 *
 * Access nature LIGNE (import_columns): e.g. "36 / 9351.3".
 * Also seen in bilan samples as "36,476".
 */
export interface ParsedLigne {
  groupeLigne: number;
  indiceLigne: string;
}

export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const d = value;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

export function parseLigne(raw: unknown): ParsedLigne | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) {
      return { groupeLigne: raw, indiceLigne: "" };
    }
    const groupe = Math.trunc(raw);
    const frac = Math.abs(raw - groupe);
    const indice = frac.toFixed(8).replace(/0+$/, "").replace(/\.$/, "").replace(/^0\./, "");
    return { groupeLigne: groupe, indiceLigne: indice };
  }

  const text = cellToText(raw);
  if (!text) return null;

  const slash = text.match(/^\s*(\d+)\s*[\/]\s*(.+?)\s*$/);
  if (slash) {
    return { groupeLigne: Number(slash[1]), indiceLigne: (slash[2] ?? "").trim() };
  }

  const comma = text.match(/^\s*(\d+)\s*[,;]\s*(.+?)\s*$/);
  if (comma) {
    return { groupeLigne: Number(comma[1]), indiceLigne: (comma[2] ?? "").trim() };
  }

  const dotted = text.match(/^\s*(\d+)\.(.+?)\s*$/);
  if (dotted) {
    return { groupeLigne: Number(dotted[1]), indiceLigne: (dotted[2] ?? "").trim() };
  }

  const onlyInt = text.match(/^\s*(\d+)\s*$/);
  if (onlyInt) {
    return { groupeLigne: Number(onlyInt[1]), indiceLigne: "" };
  }

  return null;
}

export function formatLigne(groupeLigne: number, indiceLigne: string): string {
  const indice = (indiceLigne ?? "").trim();
  return indice ? `${groupeLigne} / ${indice}` : String(groupeLigne);
}
