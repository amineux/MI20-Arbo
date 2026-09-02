import { describe, expect, it } from "vitest";
import { matchLookupByNom, matchLookupDomaineChargeur, normalizeLookupName } from "../src/lookup.js";

const fournisseurs = [
  { id: 1, nom: "CAF" },
  { id: 2, nom: "  ouest industrie " },
  { id: 3, nom: "Alstom" },
];

describe("LDD match UCase(Trim(Nom))", () => {
  it("normalizes like Access UCase(Trim())", () => {
    expect(normalizeLookupName("  ouest industrie ")).toBe("OUEST INDUSTRIE");
    expect(normalizeLookupName("CAF")).toBe("CAF");
  });

  it("matches ignoring case and padding", () => {
    expect(matchLookupByNom("CAF", fournisseurs)?.id).toBe(1);
    expect(matchLookupByNom("caf", fournisseurs)?.id).toBe(1);
    expect(matchLookupByNom("  CAF  ", fournisseurs)?.id).toBe(1);
    expect(matchLookupByNom("OUEST INDUSTRIE", fournisseurs)?.id).toBe(2);
  });

  it("does not match unknown supplier (error-log case)", () => {
    expect(matchLookupByNom("OUEST INDUSTRIE X", fournisseurs)).toBeUndefined();
  });

  it("LDDDomaineChargeur prefers scoped row", () => {
    const domaines = [
      { id: 10, nom: "ECLAIRAGE", idMetier: 1, idPerimetre: 2 },
      { id: 11, nom: "ECLAIRAGE", idMetier: 9, idPerimetre: 3 },
    ];
    const hit = matchLookupDomaineChargeur("eclairage", domaines, { idMetier: 9 });
    expect(hit?.id).toBe(11);
  });
});
