import { describe, expect, it } from "vitest";
import { buildFaImportAoa, parseFaSheet, writeAoaWorkbook, parseWorkbookToAoa } from "../src/index.js";

describe("ImportRetoursRATP / fiches d'avis parse", () => {
  it("parses NumLivrable rows and keeps lookup-like errors off the parser", () => {
    const aoa = buildFaImportAoa([
      {
        numLivrable: "36 / 9351.3",
        revision: "A",
        jalon: "JD1",
        version: "AV",
        reponseFicheAvis: "VA",
        fichierFicheAvis: "FA_36_9351.3.pdf",
        dateReceptionRATP: "2026-09-01",
        numLotRATP: "LOT-DEMO-1",
        commentairesRATP: "Avis de démonstration synthétique",
      },
      {
        numLivrable: "not-a-ligne",
        revision: "A",
        reponseFicheAvis: "VR",
      },
    ]);
    const buf = writeAoaWorkbook(aoa, "FA");
    const parsed = parseFaSheet(parseWorkbookToAoa(buf, "FA"));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      groupeLigne: 36,
      indiceLigne: "9351.3",
      reponseFicheAvis: "VA",
      jalon: "JD1",
    });
    expect(parsed.rows[0]?.errors).toHaveLength(0);
    expect(parsed.rows[1]?.errors.length).toBeGreaterThan(0);
  });
});
