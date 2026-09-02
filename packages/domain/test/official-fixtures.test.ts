import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadBundledImportColumns } from "../src/columns.js";
import { DEFAULT_PPD_CONFIG } from "../src/types.js";
import { parsePpdSheet } from "../src/parse-workbook.js";
import { parseWorkbookToAoa, fillOfficialPpdTemplate } from "../src/xlsx-io.js";
import {
  DEFAULT_RAPIDE_FIXTURE,
  JALONS_RAPIDE_FIXTURE,
  PPD_TEMPLATE_FILE,
  PPD_TEMPLATE_SMALL_FILE,
  fixturePath,
} from "../src/fixtures.js";

const emptyLookups = {};

describe("official Base Arbo fixtures", () => {
  const columns = loadBundledImportColumns();

  it("parses Import_Rapide_exemple.xlsx (default smoke fixture)", () => {
    const buf = readFileSync(fixturePath(DEFAULT_RAPIDE_FIXTURE));
    const aoa = parseWorkbookToAoa(buf);
    const parsed = parsePpdSheet(aoa, columns, emptyLookups, { ...DEFAULT_PPD_CONFIG, rapide: true });
    expect(parsed.mode).toBe("rapide");
    expect(parsed.rows.length).toBe(22);
    expect(parsed.rows[0]).toMatchObject({ groupeLigne: 3, indiceLigne: "2" });
    expect(parsed.rows[0]?.fields.Langue).toBe("FR");
    expect(parsed.rows[1]).toMatchObject({ groupeLigne: 4, indiceLigne: "" });
    expect(parsed.rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it("parses Import_Rapide_Jalons.xlsx nouveau jalon columns", () => {
    const buf = readFileSync(fixturePath(JALONS_RAPIDE_FIXTURE));
    const aoa = parseWorkbookToAoa(buf);
    const parsed = parsePpdSheet(aoa, columns, emptyLookups, { ...DEFAULT_PPD_CONFIG, rapide: true });
    expect(parsed.mode).toBe("rapide");
    expect(parsed.rows.length).toBeGreaterThanOrEqual(3);
    const first = parsed.rows[0];
    expect(first?.groupeLigne).toBe(1);
    expect(first?.jalons.some((j) => j.nom === "JS2" && j.valeur === "FP")).toBe(true);
  });

  it(
    "detects PPD_Template.xlsx Num Liv. header and jalon col 44",
    () => {
    const buf = readFileSync(fixturePath(PPD_TEMPLATE_FILE));
    const aoa = parseWorkbookToAoa(buf);
    const parsed = parsePpdSheet(aoa, columns, emptyLookups, DEFAULT_PPD_CONFIG);
    expect(parsed.mode).toBe("full");
    expect(parsed.headerRowIndex).toBe(1);
    expect(parsed.headers[0]).toBe("Num Liv.");
    expect(String(parsed.headers[43] ?? "")).toMatch(/JS0/);
    },
    30000,
  );

  it("fills Copie_de_PPD_Template.xlsx (official small copy) without inventing headers", () => {
    const template = readFileSync(fixturePath(PPD_TEMPLATE_SMALL_FILE));
    const out = fillOfficialPpdTemplate({
      templateBuffer: template,
      columns,
      maskRatp: true,
      documents: [
        {
          GroupeLigne: 36,
          IndiceLigne: "9351.3",
          Titre: "DEMO SYNTHETIQUE",
          Langue: "FR",
          jalons: [{ nom: "JD1", valeur: "FD", date: null }],
        },
      ],
    });
    const aoa = parseWorkbookToAoa(out);
    const header = aoa.find((r) =>
      (r as unknown[]).some((c) => String(c).includes("ligne") || String(c).includes("Num Liv")),
    );
    expect(header).toBeTruthy();
  });
});
