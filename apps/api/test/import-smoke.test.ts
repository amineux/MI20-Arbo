import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_RAPIDE_FIXTURE,
  BX_TEMPLATE_FILE,
  JALONS_RAPIDE_FIXTURE,
  PPD_TEMPLATE_FILE,
  buildFaImportAoa,
  writeAoaWorkbook,
  parseWorkbookToAoa,
  loadBundledImportColumns,
  parsePpdSheet,
  DEFAULT_PPD_CONFIG,
} from "@mi20/domain";
import { openMemoryDatabase } from "../src/db.js";
import { seed, dbStats } from "../src/seed.js";
import { applyImportBatch, importPpdBuffer } from "../src/import-service.js";
import { applyFaBatch, importFaBuffer, listFichesAvis } from "../src/fa-service.js";
import { LocalFileStorage } from "../src/storage.js";
import { buildApp } from "../src/app.js";
import { readOfficialFixture, seedOfficialTemplates } from "../src/templates.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mi20-"));

function multipartPayload(fileName: string, file: Buffer, fields: Record<string, string> = {}): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const boundary = "----MI20TestBoundary";
  const chunks: Buffer[] = [];
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    ),
  );
  chunks.push(file);
  chunks.push(Buffer.from("\r\n"));
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function harness() {
  const dir = tmp();
  const db = await openMemoryDatabase();
  await seed(db, { extraDocs: 0 });
  const storage = new LocalFileStorage(path.join(dir, "storage"));
  await seedOfficialTemplates(storage);
  const app = await buildApp({ db, storage });
  return { dir, db, storage, app };
}

describe("PPD import smoke (official fixtures + apply persist)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("imports Import_Rapide_exemple.xlsx, applies, and persists documents + jalons", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const buffer = readOfficialFixture(DEFAULT_RAPIDE_FIXTURE);
    const staged = await importPpdBuffer({
      db: h.db,
      storage: h.storage,
      buffer,
      fileName: DEFAULT_RAPIDE_FIXTURE,
      user: "test",
      rapide: true,
    });
    expect(staged.rowCount).toBe(22);
    expect(staged.errorCount).toBe(0);
    expect(staged.newCount).toBe(22);

    const applied = await applyImportBatch(h.db, staged.batchId, "test");
    expect(applied.appliedDocuments).toBe(22);
    expect(applied.skippedErrors).toBe(0);

    const row = await h.db.get<{ Langue: string }>(
      "SELECT Langue FROM document WHERE GroupeLigne = 3 AND IndiceLigne = '2'",
    );
    expect(row?.Langue).toBe("FR");
    const jalons = await h.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM programmation_jalon");
    expect(Number(jalons?.c)).toBeGreaterThan(0);
    const histo = await h.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM doc_histo WHERE IsImport = 1");
    expect(Number(histo?.c)).toBeGreaterThan(0);

    const demo = await h.app.inject({ method: "POST", url: "/api/imports/ppd/demo" });
    expect(demo.statusCode).toBe(200);
    expect(demo.json()).toMatchObject({ rowCount: 22, errorCount: 0 });
    await h.app.close();
    await h.db.close();
  });

  it("imports Import_Rapide_Jalons.xlsx and applies programmation_jalon", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const buffer = readOfficialFixture(JALONS_RAPIDE_FIXTURE);
    const staged = await importPpdBuffer({
      db: h.db,
      storage: h.storage,
      buffer,
      fileName: JALONS_RAPIDE_FIXTURE,
      user: "test",
      rapide: true,
    });
    expect(staged.rowCount).toBeGreaterThanOrEqual(3);
    const applied = await applyImportBatch(h.db, staged.batchId, "test");
    expect(applied.appliedDocuments).toBeGreaterThan(0);
    const pj = await h.db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM programmation_jalon pj JOIN jalon j ON j.Id = pj.IdJalon WHERE j.Code = 'JS2'",
    );
    expect(Number(pj?.c)).toBeGreaterThan(0);
    await h.app.close();
    await h.db.close();
  });

  it("parses PPD_Template.xlsx (full Num Liv.) without crashing and applies a larger synthetic full sheet", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const templateBuf = readOfficialFixture(PPD_TEMPLATE_FILE);
    const stagedTpl = await importPpdBuffer({
      db: h.db,
      storage: h.storage,
      buffer: templateBuf,
      fileName: PPD_TEMPLATE_FILE,
      user: "test",
      rapide: false,
    });
    expect(stagedTpl.rowCount).toBeGreaterThanOrEqual(0);
    const appliedTpl = await applyImportBatch(h.db, stagedTpl.batchId, "test");
    expect(appliedTpl.appliedDocuments).toBeGreaterThanOrEqual(0);

    const columns = loadBundledImportColumns();
    const aoa = parseWorkbookToAoa(templateBuf);
    const parsed = parsePpdSheet(aoa, columns, {}, DEFAULT_PPD_CONFIG);
    expect(parsed.mode).toBe("full");
    expect(parsed.headers[0]).toBe("Num Liv.");

    const header = parsed.headers;
    const rows: unknown[][] = [header];
    for (let i = 0; i < 80; i++) {
      const line = new Array(header.length).fill("");
      line[0] = `80 / ${i + 1}`;
      const titreIdx = header.findIndex((x) => String(x).toLowerCase().includes("titre"));
      const langueIdx = header.findIndex((x) => String(x).toLowerCase() === "langue");
      if (titreIdx >= 0) line[titreIdx] = `SYN FULL ${i + 1}`;
      if (langueIdx >= 0) line[langueIdx] = "FR";
      rows.push(line);
    }
    const big = writeAoaWorkbook(rows, "PPD");
    const staged = await importPpdBuffer({
      db: h.db,
      storage: h.storage,
      buffer: big,
      fileName: "synthetic_full_ppd.xlsx",
      user: "test",
      rapide: false,
    });
    expect(staged.rowCount).toBe(80);
    const applied = await applyImportBatch(h.db, staged.batchId, "test");
    expect(applied.appliedDocuments).toBe(80);
    const found = await h.db.get("SELECT Titre FROM document WHERE GroupeLigne = 80 AND IndiceLigne = '1'");
    expect(found).toBeTruthy();
    await h.app.close();
    await h.db.close();
  }, 60000);

  it("records LDD lookup errors without crashing and skips them on apply", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const aoa: unknown[][] = [
      ["Nr Livrable", "Fournisseur", "Langue"],
      ["90 / 1", "CAF", "FR"],
      ["90 / 2", "INCONNU_XYZ", "FR"],
    ];
    const buf = writeAoaWorkbook(aoa, "PPD");
    const staged = await importPpdBuffer({
      db: h.db,
      storage: h.storage,
      buffer: buf,
      fileName: "ldd-errors.xlsx",
      user: "test",
      rapide: true,
    });
    expect(staged.rowCount).toBe(2);
    expect(staged.errorCount).toBe(1);
    const applied = await applyImportBatch(h.db, staged.batchId, "test");
    expect(applied.appliedDocuments).toBe(1);
    expect(applied.skippedErrors).toBe(1);
    const ok = await h.db.get("SELECT Id FROM document WHERE GroupeLigne = 90 AND IndiceLigne = '1'");
    const bad = await h.db.get("SELECT Id FROM document WHERE GroupeLigne = 90 AND IndiceLigne = '2'");
    expect(ok).toBeTruthy();
    expect(bad).toBeUndefined();
    const detail = await h.app.inject({ method: "GET", url: `/api/imports/${staged.batchId}` });
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { errors: unknown[] }).errors.length).toBe(1);
    await h.app.close();
    await h.db.close();
  });

  it("rejects lookup names that differ only by case (UCase Trim / NOCASE)", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const again = await h.app.inject({
      method: "POST",
      url: "/api/lookups/fournisseur",
      payload: { nom: "caf" },
    });
    expect(again.statusCode).toBe(409);
    const mixed = await h.app.inject({
      method: "POST",
      url: "/api/lookups/fournisseur",
      payload: { nom: "Caf" },
    });
    expect(mixed.statusCode).toBe(409);
    await h.app.close();
    await h.db.close();
  });

  it("multipart-uploads a new full PPD (Num Liv.) with a trailing field, applies, and search finds it", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const aoa: unknown[][] = [
      ["Num Liv.", "Titre du document", "Langue", "Fournisseur"],
      ["70 / 1", "NOUVEAU PPD UPLOAD", "FR", "CAF"],
      ["70 / 2", "NOUVEAU PPD UPLOAD 2", "FR", "CAF"],
    ];
    const buf = writeAoaWorkbook(aoa, "PPD");
    const { payload, headers } = multipartPayload("nouveau_ppd.xlsx", buf, { rapide: "false" });
    const staged = await h.app.inject({
      method: "POST",
      url: "/api/imports/ppd?rapide=false",
      headers,
      payload,
    });
    expect(staged.statusCode).toBe(200);
    const body = staged.json() as { batchId: number; rowCount: number; newCount: number; errorCount: number };
    expect(body.rowCount).toBe(2);
    expect(body.newCount).toBe(2);
    expect(body.errorCount).toBe(0);

    const detail = await h.app.inject({ method: "GET", url: `/api/imports/${body.batchId}` });
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { nouveaux: unknown[] }).nouveaux.length).toBeGreaterThan(0);

    const applied = await h.app.inject({ method: "POST", url: `/api/imports/${body.batchId}/apply` });
    expect(applied.statusCode).toBe(200);
    expect((applied.json() as { appliedDocuments: number }).appliedDocuments).toBe(2);

    const found = await h.app.inject({ method: "GET", url: "/api/documents?search=70%20/%201" });
    expect(found.statusCode).toBe(200);
    const docs = found.json() as { total: number; rows: Array<{ Titre: string }> };
    expect(docs.total).toBeGreaterThanOrEqual(1);
    expect(docs.rows.some((r) => r.Titre === "NOUVEAU PPD UPLOAD")).toBe(true);

    const stats = await h.app.inject({ method: "GET", url: "/api/stats" });
    expect((stats.json() as { documents: number }).documents).toBeGreaterThanOrEqual(5);

    await h.app.close();
    await h.db.close();
  });

  it("demo PPD_Template.xlsx (sparse official) yields applyable full-mode rows", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const demo = await h.app.inject({
      method: "POST",
      url: "/api/imports/ppd/demo?file=PPD_Template.xlsx&rapide=false",
    });
    expect(demo.statusCode).toBe(200);
    const body = demo.json() as { batchId: number; rowCount: number; warnings: string[] };
    expect(body.rowCount).toBe(40);
    const applied = await h.app.inject({ method: "POST", url: `/api/imports/${body.batchId}/apply` });
    expect(applied.statusCode).toBe(200);
    expect((applied.json() as { appliedDocuments: number }).appliedDocuments).toBe(40);
    const row = await h.db.get<{ Titre: string }>(
      "SELECT Titre FROM document WHERE GroupeLigne = 70 AND IndiceLigne = '1'",
    );
    expect(row?.Titre).toMatch(/PPD COMPLET DEMO/);
    await h.app.close();
    await h.db.close();
  }, 60000);

  it("returns the French parse error on a workbook without PPD headers (not Internal Server Error)", async () => {
    const h = await harness();
    dirs.push(h.dir);
    const buf = writeAoaWorkbook([["Pas un PPD"], ["rien"]], "Cover");
    const { payload, headers } = multipartPayload("not-ppd.xlsx", buf, { rapide: "false" });
    const res = await h.app.inject({
      method: "POST",
      url: "/api/imports/ppd",
      headers,
      payload,
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).toMatch(/En-tête PPD/);
    expect(body.error).not.toMatch(/Internal Server Error/);
    await h.app.close();
    await h.db.close();
  });
});

describe("Bordereau create + EXPORT_BX ZIP", () => {
  it("creates BX, attaches documents, exports pack, downloads ZIP (one-click)", async () => {
    const dir = tmp();
    const db = await openMemoryDatabase();
    await seed(db, { extraDocs: 0 });
    const storage = new LocalFileStorage(path.join(dir, "storage"));
    await seedOfficialTemplates(storage);
    const app = await buildApp({ db, storage });

    const leader = await db.get<{ id: number }>("SELECT id FROM lookup_row WHERE table_key = 'Leader' LIMIT 1");
    const created = await app.inject({
      method: "POST",
      url: "/api/bordereaux",
      payload: { idLeader: leader?.id, numero: 32 },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json() as { id: number; nomComplet: string };
    expect(body.nomComplet).toMatch(/^MI20_BORD_/);

    const doc = await db.get<{ Id: number }>("SELECT Id FROM document LIMIT 1");
    const attached = await app.inject({
      method: "POST",
      url: `/api/bordereaux/${body.id}/documents`,
      payload: { documentIds: [doc?.Id] },
    });
    expect(attached.statusCode).toBe(200);

    const exported = await app.inject({ method: "POST", url: `/api/bordereaux/${body.id}/export` });
    expect(exported.statusCode).toBe(200);
    const pack = exported.json() as { folder: string; files: string[] };
    expect(pack.folder).toContain("EXPORT_BX/MI20_BORD_");
    expect(pack.files.some((f) => f.endsWith(BX_TEMPLATE_FILE))).toBe(true);
    expect(await storage.exists(`${pack.folder}/${BX_TEMPLATE_FILE}`)).toBe(true);

    const zip = await app.inject({ method: "GET", url: `/api/bordereaux/${body.id}/download` });
    expect(zip.statusCode).toBe(200);
    expect(zip.headers["content-type"]).toContain("zip");
    const raw = zip.rawPayload as Buffer;
    expect(raw.subarray(0, 2).toString()).toBe("PK");
    expect(raw.length).toBeGreaterThan(100);

    await app.close();
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("Import fiches d'avis / retours RATP", () => {
  it("imports FA excel, applies, and updates revision + envoi + fiche_avis (no silent no-op)", async () => {
    const dir = tmp();
    const db = await openMemoryDatabase();
    await seed(db, { extraDocs: 0 });
    const storage = new LocalFileStorage(path.join(dir, "storage"));
    await seedOfficialTemplates(storage);
    const app = await buildApp({ db, storage });

    const before = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM fiche_avis");
    const aoa = buildFaImportAoa([
      {
        numLivrable: "36 / 9351.3",
        revision: "B",
        jalon: "JD1",
        version: "AV",
        reponseFicheAvis: "VA",
        fichierFicheAvis: "FA_36_9351.3_VA.pdf",
        dateReceptionRATP: "2026-09-01",
        numLotRATP: "LOT-DEMO-1",
        commentairesRATP: "Retour RATP de démonstration",
      },
      {
        numLivrable: "99 / 404",
        revision: "A",
        reponseFicheAvis: "VR",
      },
    ]);
    const buffer = writeAoaWorkbook(aoa, "FA");
    const staged = await importFaBuffer({
      db,
      storage,
      buffer,
      fileName: "Import_Retours_RATP_exemple.xlsx",
      user: "test",
    });
    expect(staged.rowCount).toBe(2);
    expect(staged.errorCount).toBe(1);
    expect(staged.matchedCount).toBe(1);

    const applied = await applyFaBatch(db, staged.batchId, "test");
    expect(applied.appliedFiches).toBe(1);
    expect(applied.updatedEnvois).toBe(1);
    expect(applied.updatedRevisions).toBeGreaterThanOrEqual(1);
    expect(applied.skippedErrors).toBe(1);

    const after = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM fiche_avis");
    expect(Number(after?.c)).toBe(Number(before?.c) + 1);

    const envoi = await db.get<{ ReponseFicheAvis: string; FichierFicheAvis_Envoye: string }>(
      "SELECT ReponseFicheAvis, FichierFicheAvis_Envoye FROM envoi ORDER BY Id DESC LIMIT 1",
    );
    expect(envoi?.ReponseFicheAvis).toBe("VA");
    expect(envoi?.FichierFicheAvis_Envoye).toBe("FA_36_9351.3_VA.pdf");

    const rev = await db.get<{ Revision: string; FichierFicheAvis_AEnvoyer: string }>(
      "SELECT Revision, FichierFicheAvis_AEnvoyer FROM revision ORDER BY Id DESC LIMIT 1",
    );
    expect(rev?.Revision).toBe("B");
    expect(rev?.FichierFicheAvis_AEnvoyer).toBe("FA_36_9351.3_VA.pdf");

    const listed = await listFichesAvis(db);
    expect(listed.some((r) => String((r as { ReponseFicheAvis?: string }).ReponseFicheAvis) === "VA")).toBe(true);

    const demoFa = await app.inject({ method: "POST", url: "/api/imports/fa/demo" });
    expect(demoFa.statusCode).toBe(200);
    expect((demoFa.json() as { rowCount: number }).rowCount).toBeGreaterThanOrEqual(2);

    const saisie = await app.inject({
      method: "POST",
      url: "/api/ratp-returns",
      payload: { idDocument: (await db.get<{ Id: number }>("SELECT Id FROM document WHERE GroupeLigne = 36 AND IndiceLigne = '476'"))?.Id, avis: "FA", commentaire: "saisie manuelle" },
    });
    expect(saisie.statusCode).toBe(200);

    await app.close();
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("Scale seed + indexes", () => {
  it("seeds a few thousand synthetic documents and looks up by business key", async () => {
    const db = await openMemoryDatabase();
    await seed(db, { extraDocs: 2500 });
    const stats = await dbStats(db);
    expect(stats.documents).toBeGreaterThanOrEqual(2503);
    expect(stats.jalonsProgrammes).toBeGreaterThanOrEqual(2500);
    const hit = await db.get<{ Titre: string }>(
      "SELECT Titre FROM document WHERE GroupeLigne = 100 AND IndiceLigne = '1'",
    );
    expect(hit?.Titre).toMatch(/SYNTHETIQUE/);
    await db.close();
  }, 60000);
});
