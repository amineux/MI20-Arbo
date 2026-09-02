import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DEFAULT_RAPIDE_FIXTURE, BX_TEMPLATE_FILE } from "@mi20/domain";
import { openDatabase } from "../src/db.js";
import { seed } from "../src/seed.js";
import { applyImportBatch, importPpdBuffer } from "../src/import-service.js";
import { LocalFileStorage } from "../src/storage.js";
import { buildApp } from "../src/app.js";
import { readOfficialFixture, seedOfficialTemplates } from "../src/templates.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mi20-"));

describe("PPD import smoke (official Import_Rapide_exemple.xlsx)", () => {
  let dir: string;

  beforeEach(() => {
    dir = tmp();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("imports the official rapide example and applies all rows", async () => {
    const db = openDatabase(":memory:");
    seed(db);
    const storage = new LocalFileStorage(path.join(dir, "storage"));
    await seedOfficialTemplates(storage);
    const buffer = readOfficialFixture(DEFAULT_RAPIDE_FIXTURE);

    const staged = await importPpdBuffer({
      db,
      storage,
      buffer,
      fileName: DEFAULT_RAPIDE_FIXTURE,
      user: "test",
      rapide: true,
    });
    expect(staged.rowCount).toBe(22);
    expect(staged.errorCount).toBe(0);
    expect(staged.newCount).toBe(22);

    const applied = applyImportBatch(db, staged.batchId, "test");
    expect(applied.appliedDocuments).toBe(22);

    const row = db
      .prepare("SELECT Langue FROM document WHERE GroupeLigne = 3 AND IndiceLigne = '2'")
      .get() as { Langue: string };
    expect(row.Langue).toBe("FR");

    const app = await buildApp({ db, storage });
    const demo = await app.inject({ method: "POST", url: "/api/imports/ppd/demo" });
    expect(demo.statusCode).toBe(200);
    expect(demo.json()).toMatchObject({ rowCount: 22, errorCount: 0 });
    await app.close();
    db.close();
  });

  it("creates a bordereau pack with official MI20_BORD_TEMPLATE_M5_V12.xls", async () => {
    const db = openDatabase(":memory:");
    seed(db);
    const storage = new LocalFileStorage(path.join(dir, "storage"));
    await seedOfficialTemplates(storage);
    const app = await buildApp({ db, storage });
    const leader = db.prepare("SELECT id FROM lookup_row WHERE table_key = 'Leader' LIMIT 1").get() as { id: number };
    const created = await app.inject({
      method: "POST",
      url: "/api/bordereaux",
      payload: { idLeader: leader.id, numero: 32 },
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
    const pack = exported.json() as { folder: string; files: string[] };
    expect(pack.folder).toContain("EXPORT_BX/MI20_BORD_");
    expect(pack.files.some((f) => f.endsWith(BX_TEMPLATE_FILE))).toBe(true);
    expect(await storage.exists(`${pack.folder}/${BX_TEMPLATE_FILE}`)).toBe(true);
    await app.close();
    db.close();
  });
});
