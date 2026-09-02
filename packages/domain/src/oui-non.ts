const TRUE_TOKENS = new Set(["O", "OUI", "Y", "YES", "1", "TRUE", "VRAI", "X"]);
const FALSE_TOKENS = new Set(["N", "NON", "NO", "0", "FALSE", "FAUX", ""]);

/** Nature OUINON / AUTORISANT (Homologuant). */
export function parseOuiNon(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  const token = String(raw).replace(/\u00a0/g, " ").trim().toUpperCase();
  if (TRUE_TOKENS.has(token)) return true;
  if (FALSE_TOKENS.has(token)) return false;
  return null;
}

export function formatOuiNon(value: boolean | null | undefined): string {
  if (value === true) return "O";
  if (value === false) return "N";
  return "";
}
