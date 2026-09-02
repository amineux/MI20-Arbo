import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseImportColumnsCsv, indexColumnsByHeader, normalizeHeader } from "../src/columns.js";
import { DEFAULT_PPD_CONFIG } from "../src/types.js";

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../data/import_columns.csv");

describe("import_columns mapping", () => {
  const columns = parseImportColumnsCsv(readFileSync(csvPath, "utf8"));

  it("loads all mapping rows from handoff CSV (53 data rows)", () => {
    expect(columns).toHaveLength(53);
  });

  it("maps Num Liv. as LIGNE → GroupeLigne", () => {
    const col = columns.find((c) => c.documentField === "GroupeLigne");
    expect(col?.ppdTitle).toBe("Num Liv.");
    expect(col?.nature).toBe("LIGNE");
    expect(col?.toImport).toBe(true);
    expect(col?.destTable).toBe("document");
  });

  it("maps Fournisseur as LDD to table fournisseur", () => {
    const col = columns.find((c) => c.documentField === "IdFournisseur");
    expect(col?.nature).toBe("LDD");
    expect(col?.associatedTable).toBe("fournisseur");
    expect(col?.ppdTitle).toBe("Fournisseur");
  });

  it("maps Domaine chargeur as LDDDomaineChargeur", () => {
    const col = columns.find((c) => c.documentField === "IdDomaineChargeur");
    expect(col?.nature).toBe("LDDDomaineChargeur");
    expect(col?.associatedTable).toBe("domaineChargeur");
  });

  it("maps Homologuant as AUTORISANT", () => {
    const col = columns.find((c) => c.documentField === "Homologuant");
    expect(col?.nature).toBe("AUTORISANT");
  });

  it("maps Jalon nature J to jalon dest", () => {
    const col = columns.find((c) => c.nature === "J");
    expect(col?.ppdTitle).toBe("Jalon");
    expect(col?.destTable).toBe("jalon");
    expect(col?.toImport).toBe(true);
  });

  it("keeps AImporter=0 columns (export-only) out of default import", () => {
    const skipped = columns.filter((c) => !c.toImport);
    expect(skipped.map((c) => c.documentField)).toEqual(
      expect.arrayContaining(["Tranche", "SiteEmetteur", "NumBordereau", "Statut_RATP"]),
    );
  });

  it("indexes headers case-insensitively", () => {
    const map = indexColumnsByHeader(columns);
    expect(map.get(normalizeHeader("num liv."))?.nature).toBe("LIGNE");
    expect(map.get(normalizeHeader("Fournisseur"))?.documentField).toBe("IdFournisseur");
  });

  it("matches config.ini first/last column titles", () => {
    expect(columns[0]?.ppdTitle).toBe(DEFAULT_PPD_CONFIG.firstColumnTitle);
    expect(columns.find((c) => c.documentField === "DateResoumission")?.ppdTitle).toBe(
      DEFAULT_PPD_CONFIG.lastColumnTitle,
    );
  });

  it("rejects unknown natures", () => {
    expect(() =>
      parseImportColumnsCsv("Id,col,titre,nature,t,A,d\n1,x,y,NOPE,,1,document\n"),
    ).toThrow(/Unknown import_columns nature/);
  });
});
