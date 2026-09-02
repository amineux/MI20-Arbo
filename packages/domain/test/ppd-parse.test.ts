import { describe, expect, it } from "vitest";
import { computeDifferences } from "../src/compare.js";
import { parseImportColumnsCsv } from "../src/columns.js";
import { parsePpdSheet } from "../src/parse-workbook.js";
import { unpivotJalons } from "../src/jalon.js";
import { DEFAULT_PPD_CONFIG } from "../src/types.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSamplePpdAoa, sampleLookups, sampleJalons } from "./sample-ppd.js";
import { parseOuiNon } from "../src/oui-non.js";

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../data/import_columns.csv");

describe("PPD sheet parse + jalon unpivot", () => {
  const columns = parseImportColumnsCsv(readFileSync(csvPath, "utf8"));
  const aoa = buildSamplePpdAoa();

  it("detects Num Liv. header and parses LIGNE keys", () => {
    const parsed = parsePpdSheet(aoa, columns, sampleLookups, DEFAULT_PPD_CONFIG);
    expect(parsed.mode).toBe("full");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({ groupeLigne: 36, indiceLigne: "9351.3" });
    expect(parsed.rows[1]).toMatchObject({ groupeLigne: 36, indiceLigne: "1001" });
    expect(parsed.rows[2]).toMatchObject({ groupeLigne: 36, indiceLigne: "2002" });
  });

  it("resolves LDD fournisseur CAF and flags unknown OUEST INDUSTRIE", () => {
    const parsed = parsePpdSheet(aoa, columns, sampleLookups, DEFAULT_PPD_CONFIG);
    expect(parsed.rows[0]?.fields.IdFournisseur).toBe(1);
    expect(parsed.rows[1]?.errors.some((e) => e.includes("OUEST INDUSTRIE") && e.includes("fournisseur"))).toBe(
      true,
    );
    expect(parsed.rows[2]?.fields.IdFournisseur).toBe(1);
  });

  it("unpivots jalon cols 44–66 / dates 67–89 (nbJalonsPPD=23)", () => {
    const header = aoa[0] ?? [];
    const data = aoa[1] ?? [];
    const slots = unpivotJalons(header, data, DEFAULT_PPD_CONFIG);
    const jd1 = slots.find((s) => s.nom === "JD1");
    expect(jd1?.valeur).toBe("FD");
    expect(jd1?.index).toBe(5);
    expect(slots.find((s) => s.nom === "JS0")?.nom).toBe("JS0");
  });

  it("computes compare diffs vs existing document (Form_import_compare)", () => {
    const parsed = parsePpdSheet(aoa, columns, sampleLookups, DEFAULT_PPD_CONFIG);
    const diffs = computeDifferences({
      staged: parsed.rows,
      existing: [
        {
          id: 1,
          groupeLigne: 36,
          indiceLigne: "9351.3",
          fields: {
            Titre: "Ancien titre",
            RefExt: "CAF-ECH-007",
            Revision: "A",
            IdFournisseur: 1,
            Livrable: "36 - Dossiers de Définition",
          },
          jalons: [{ idJalon: 5, code: "JD1", valeur: "AV", date: null, estPrevisionnel: false }],
        },
      ],
      columns,
      lookups: sampleLookups,
      jalons: sampleJalons,
    });
    const titre = diffs.find((d) => d.fieldName === "Titre");
    expect(titre?.oldValue).toBe("Ancien titre");
    expect(titre?.newValue).toContain("AXE CROCHET");
    expect(diffs.some((d) => d.nouveauDocument && d.groupeLigne === 36 && d.indiceLigne === "2002")).toBe(true);
    const jalon = diffs.find((d) => d.fieldName === "Jalon:JD1");
    expect(jalon?.oldValue).toContain("AV");
    expect(jalon?.newValue).toContain("FD");
  });

  it("parses OUINON / AUTORISANT", () => {
    expect(parseOuiNon("O")).toBe(true);
    expect(parseOuiNon("Non")).toBe(false);
    expect(parseOuiNon("oui")).toBe(true);
  });

  it("rapide mode uses Nr Livrable first column", () => {
    const rapideSheet: unknown[][] = [
      ["Nr Livrable", "Indice de révision", "Date de la prochaine soumission"],
      ["36 / 9351.3", "B", "01/09/2026"],
    ];
    const parsed = parsePpdSheet(rapideSheet, columns, sampleLookups, {
      ...DEFAULT_PPD_CONFIG,
      rapide: true,
    });
    expect(parsed.mode).toBe("rapide");
    expect(parsed.rows[0]?.fields.Revision).toBe("B");
    expect(parsed.rows[0]?.fields.IdFournisseur).toBeUndefined();
  });
});
