import type { LookupRow } from "./types.js";

/** Access LDD match: UCase(Trim(Nom)). */
export function normalizeLookupName(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim().toUpperCase();
}

export function matchLookupByNom(
  raw: unknown,
  rows: LookupRow[],
): LookupRow | undefined {
  if (raw === null || raw === undefined) return undefined;
  const key = normalizeLookupName(String(raw));
  if (!key) return undefined;
  return rows.find((r) => normalizeLookupName(r.nom) === key);
}

/**
 * LDDDomaineChargeur: match UCase(Trim(Nom)), preferring rows whose
 * domain/métier/périmètre already resolved on the same PPD line.
 */
export function matchLookupDomaineChargeur(
  raw: unknown,
  rows: LookupRow[],
  scope?: { idPerimetre?: number | null; idDomaine?: number | null; idMetier?: number | null },
): LookupRow | undefined {
  const key = normalizeLookupName(raw === null || raw === undefined ? "" : String(raw));
  if (!key) return undefined;
  const matches = rows.filter((r) => normalizeLookupName(r.nom) === key);
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  const scoped = matches.filter((r) => {
    if (scope?.idMetier && r.idMetier && r.idMetier !== scope.idMetier) return false;
    if (scope?.idDomaine && r.idDomaine && r.idDomaine !== scope.idDomaine) return false;
    if (scope?.idPerimetre && r.idPerimetre && r.idPerimetre !== scope.idPerimetre) return false;
    return true;
  });
  return scoped[0] ?? matches[0];
}

export function lookupTableKey(tableAssociee: string | null | undefined): string {
  return (tableAssociee ?? "").trim();
}
