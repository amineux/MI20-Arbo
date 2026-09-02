import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as XLSX from "xlsx";
import { openDatabase } from "../src/db.js";
import { seed } from "../src/seed.js";
import { applyImportBatch, importPpdBuffer } from "../src/import-service.js";
import { LocalFileStorage } from "../src/storage.js";
import { buildApp } from "../src/app.js";
import { buildSamplePpdAoa } from "../../../packages/domain/test/sample-ppd.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mi20-"));

describe("PPD import smoke (Excel fixture)", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmp();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("uploads sample PPD, stages compare, applies without error rows", async () => {
    const db = openDatabase(":memory:");
    seed(db);
    const storage = new LocalFileStorage(path.join(dir, "storage"));
    const aoa = buildSamplePpdAoa();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PPD");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const staged = await importPpdBuffer({
      db,
      storage,
      buffer,
      fileName: "ppd_sample.xlsx",
      user: "test",
      rapide: false,
    });
    expect(staged.rowCount).toBe(3);
    expect(staged.errorCount).toBe(1);
    expect(staged.diffCount).toBeGreaterThan(0);

    const applied = applyImportBatch(db, staged.batchId, "test");
    expect(applied.appliedDocuments).toBeGreaterThan(0);

    const updated = db
      .prepare("SELECT Titre FROM document WHERE GroupeLigne = 36 AND IndiceLigne = '9351.3'")
      .get() as { Titre: string };
    expect(updated.Titre).toContain("AXE CROCHET");

    const created = db
      .prepare("SELECT Id FROM document WHERE GroupeLigne = 36 AND IndiceLigne = '2002'")
      .get();
    expect(created).toBeTruthy();

    const skipped = db
      .prepare("SELECT Id FROM document WHERE GroupeLigne = 36 AND IndiceLigne = '1001'")
      .get();
    expect(skipped).toBeFalsy();

    const app = await buildApp({ db, storage });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    await app.close();
    db.close();
  });

  it("creates a bordereau pack under EXPORT_BX/MI20_BORD_*", async () => {
    const db = openDatabase(":memory:");
    seed(db);
    const storage = new LocalFileStorage(path.join(dir, "storage"));
    const app = await buildApp({ db, storage });
    const leader = db.prepare("SELECT id FROM lookup_row WHERE table_key = 'Leader' LIMIT 1").get() as { id: number };
    const created = await app.inject({
      method: "POST",
      url: "/api/bordereaux",
      payload: { idLeader: leader.id, numero: 938 },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json() as { id: number; nomComplet: string };
    expect(body.nomComplet).toMatch(/^MI20_BORD_/);

    const doc = db.prepare("SELECT Id FROM document LIMIT 1").get() as { Id: number };
    await app.inject({
      method: "POST",
      url: `/api/bordereaux/${body.id}/documents`,
      payload: { documentIds: [doc.Id] },
    });
    const exported = await app.inject({ method: "POST", url: `/api/bordereaux/${body.id}/export` });
    const pack = exported.json() as { folder: string };
    expect(pack.folder).toContain("EXPORT_BX/MI20_BORD_");
    expect(await storage.exists(`${pack.folder}/MANIFEST.txt`)).toBe(true);
    await app.close();
    db.close();
  });
});
