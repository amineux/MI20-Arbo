import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import archiver from "archiver";
import {
  buildPpdExportWorkbook,
  DEFAULT_PPD_CONFIG,
  DEFAULT_RAPIDE_FIXTURE,
  FA_RAPIDE_FIXTURE,
  fillOfficialPpdTemplate,
  JALONS_RAPIDE_FIXTURE,
  loadBundledImportColumns,
  PPD_TEMPLATE_FILE,
} from "@mi20/domain";
import { authHook, entraClientConfig } from "./auth.js";
import { applyImportBatch, importPpdBuffer, listJalons, loadDocumentSnapshots, ppdConfigFromDb } from "./import-service.js";
import { applyFaBatch, createFicheAvis, importFaBuffer, listFichesAvis } from "./fa-service.js";
import { dbStats, loadLookupCatalog } from "./seed.js";
import type { SqlDatabase } from "./sql.js";
import type { FileStorage } from "./storage.js";
import {
  BX_TEMPLATE_FILE,
  listTemplates,
  readOfficialFixture,
  readTemplate,
} from "./templates.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface AppDeps {
  db: SqlDatabase;
  storage: FileStorage;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 80 * 1024 * 1024 } });
  app.addHook("preHandler", authHook);

  const webDist = process.env.WEB_DIST ?? path.resolve(here, "../../web/dist");

  app.get("/api/health", async () => ({
    ok: true,
    name: "MI20 Arbo",
    storage: deps.storage.kind,
    dialect: deps.db.dialect,
    time: new Date().toISOString(),
  }));

  app.get("/api/auth/config", async () => entraClientConfig());

  app.get("/api/meta", async () => {
    const lock = await deps.db.get("SELECT * FROM app_lock WHERE id = 1");
    const project = await deps.db.get<{ value: string }>("SELECT value FROM app_config WHERE key = 'projectName'");
    const stats = await dbStats(deps.db);
    return {
      projectName: project?.value ?? "MI20 Arbo",
      version: "1.1.0",
      inspiredBy: "Access BASE ARBO MI20 IHM 1.6.6",
      lock,
      ppd: DEFAULT_PPD_CONFIG,
      bxTemplate: "MI20_BORD_TEMPLATE_M5_V12.xls",
      defaultImportFixture: DEFAULT_RAPIDE_FIXTURE,
      faImportFixture: FA_RAPIDE_FIXTURE,
      templates: listTemplates(),
      dialect: deps.db.dialect,
      stats,
    };
  });

  app.get("/api/stats", async () => dbStats(deps.db));

  app.get("/api/lock", async () => deps.db.get("SELECT * FROM app_lock WHERE id = 1"));
  app.post("/api/lock", async (req) => {
    const body = (req.body ?? {}) as { locked?: boolean; message?: string };
    await deps.db.run(
      "UPDATE app_lock SET locked = ?, message = ?, locked_by = ?, locked_at = datetime('now') WHERE id = 1",
      [body.locked ? 1 : 0, body.message ?? null, req.user?.name ?? "demo"],
    );
    return deps.db.get("SELECT * FROM app_lock WHERE id = 1");
  });

  registerDocumentRoutes(app, deps);
  registerLookupRoutes(app, deps);
  registerImportRoutes(app, deps);
  registerExportRoutes(app, deps);
  registerBordereauRoutes(app, deps);
  registerRevisionAndFaRoutes(app, deps);

  if (fs.existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        reply.code(404).send({ error: "Not found" });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  return app;
}

function registerDocumentRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/documents", async (req) => {
    const q = req.query as Record<string, string>;
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (q.search) {
      where.push(
        "(Titre LIKE ? OR RefExt LIKE ? OR CAST(GroupeLigne AS TEXT) LIKE ? OR IndiceLigne LIKE ? OR Livrable LIKE ?)",
      );
      const like = `%${q.search}%`;
      params.push(like, like, like, like, like);
    }
    if (q.groupeLigne) {
      where.push("GroupeLigne = ?");
      params.push(Number(q.groupeLigne));
    }
    if (q.indiceLigne) {
      where.push("IndiceLigne = ?");
      params.push(q.indiceLigne);
    }
    if (q.fournisseurId) {
      where.push("IdFournisseur = ?");
      params.push(Number(q.fournisseurId));
    }
    if (q.domaineChargeurId) {
      where.push("IdDomaineChargeur = ?");
      params.push(Number(q.domaineChargeurId));
    }
    if (q.revision) {
      where.push("Revision = ?");
      params.push(q.revision);
    }
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(500, Math.max(10, Number(q.pageSize ?? 50)));
    const total = (
      await deps.db.get<{ c: number }>(`SELECT COUNT(*) as c FROM document WHERE ${where.join(" AND ")}`, params)
    )?.c ?? 0;
    const rows = await deps.db.all(
      `SELECT d.*,
          (SELECT nom FROM lookup_row WHERE id = d.IdFournisseur) as FournisseurNom,
          (SELECT nom FROM lookup_row WHERE id = d.IdDomaineChargeur) as DomaineChargeurNom,
          (SELECT nom FROM lookup_row WHERE id = d.IdLeader) as LeaderNom
       FROM document d
       WHERE ${where.join(" AND ")}
       ORDER BY GroupeLigne, IndiceLigne
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { total, page, pageSize, rows };
  });

  app.get("/api/documents/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const doc = await deps.db.get("SELECT * FROM document WHERE Id = ?", [id]);
    if (!doc) {
      reply.code(404).send({ error: "Document introuvable" });
      return;
    }
    const jalons = await deps.db.all(
      `SELECT pj.*, j.Nom as JalonNom, j.Code as JalonCode
       FROM programmation_jalon pj JOIN jalon j ON j.Id = pj.IdJalon
       WHERE pj.IdDocument = ?`,
      [id],
    );
    const histo = await deps.db.all("SELECT * FROM doc_histo WHERE IdDocument = ? ORDER BY Id DESC LIMIT 100", [id]);
    return { document: doc, jalons, histo };
  });

  app.put("/api/documents/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const existing = await deps.db.get<Record<string, unknown>>("SELECT * FROM document WHERE Id = ?", [id]);
    if (!existing) {
      reply.code(404).send({ error: "Document introuvable" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const allowed = Object.keys(existing).filter((k) => k !== "Id");
    const sets: string[] = [];
    const params: unknown[] = [];
    const now = new Date().toISOString();
    for (const k of allowed) {
      if (!(k in body)) continue;
      const next = body[k];
      if (String(existing[k] ?? "") === String(next ?? "")) continue;
      sets.push(`${k} = ?`);
      params.push(next);
      await deps.db.run(
        `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, existing.GroupeLigne, existing.IndiceLigne, k, String(existing[k] ?? ""), String(next ?? ""), req.user?.name ?? "demo", now],
      );
    }
    if (sets.length) {
      params.push(id);
      await deps.db.run(`UPDATE document SET ${sets.join(", ")} WHERE Id = ?`, params);
    }
    return deps.db.get("SELECT * FROM document WHERE Id = ?", [id]);
  });
}

function registerLookupRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/lookups", async () => {
    const tables = await deps.db.all("SELECT table_key, label_fr FROM lookup_table ORDER BY label_fr");
    return { tables, catalog: await loadLookupCatalog(deps.db) };
  });

  app.get("/api/lookups/:table", async (req) => {
    const table = (req.params as { table: string }).table;
    const rows = await deps.db.all(
      "SELECT id, nom, id_perimetre, id_domaine, id_metier FROM lookup_row WHERE table_key = ? ORDER BY nom",
      [table],
    );
    return { table, rows };
  });

  app.post("/api/lookups/:table", async (req, reply) => {
    const table = (req.params as { table: string }).table;
    const body = req.body as { nom?: string; idPerimetre?: number; idDomaine?: number; idMetier?: number };
    if (!body.nom?.trim()) {
      reply.code(400).send({ error: "Nom obligatoire" });
      return;
    }
    const info = await deps.db.run(
      "INSERT INTO lookup_row (table_key, nom, id_perimetre, id_domaine, id_metier) VALUES (?, ?, ?, ?, ?)",
      [table, body.nom.trim(), body.idPerimetre ?? null, body.idDomaine ?? null, body.idMetier ?? null],
    );
    return { id: info.lastInsertId, nom: body.nom.trim() };
  });

  app.put("/api/lookups/:table/:id", async (req) => {
    const { table, id } = req.params as { table: string; id: string };
    const body = req.body as { nom?: string };
    await deps.db.run("UPDATE lookup_row SET nom = ? WHERE id = ? AND table_key = ?", [body.nom, Number(id), table]);
    return { ok: true };
  });

  app.delete("/api/lookups/:table/:id", async (req) => {
    const { table, id } = req.params as { table: string; id: string };
    await deps.db.run("DELETE FROM lookup_row WHERE id = ? AND table_key = ?", [Number(id), table]);
    return { ok: true };
  });

  app.get("/api/jalons", async () => ({ rows: await listJalons(deps.db) }));
}

function registerImportRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/templates", async () => ({ rows: listTemplates() }));

  app.get("/api/templates/:file", async (req, reply) => {
    const file = decodeURIComponent((req.params as { file: string }).file);
    try {
      const buf = await readTemplate(deps.storage, file);
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${file}"`)
        .send(buf);
    } catch (err) {
      reply.code(404).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/imports/ppd/demo", async (req) => {
    const q = req.query as { rapide?: string; file?: string };
    const allowed = new Set([DEFAULT_RAPIDE_FIXTURE, JALONS_RAPIDE_FIXTURE, PPD_TEMPLATE_FILE]);
    const fileName = allowed.has(q.file ?? "") ? (q.file as string) : DEFAULT_RAPIDE_FIXTURE;
    const rapide = q.rapide !== "false" && fileName !== PPD_TEMPLATE_FILE;
    const buffer = readOfficialFixture(fileName);
    return importPpdBuffer({
      db: deps.db,
      storage: deps.storage,
      buffer,
      fileName,
      user: req.user?.name ?? "demo.user",
      rapide,
    });
  });

  app.post("/api/imports/ppd", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      reply.code(400).send({ error: "Fichier Excel PPD manquant" });
      return;
    }
    const buffer = await file.toBuffer();
    const rapide =
      (file.fields?.rapide as { value?: string } | undefined)?.value === "true" ||
      (req.query as { rapide?: string }).rapide === "true";
    return importPpdBuffer({
      db: deps.db,
      storage: deps.storage,
      buffer,
      fileName: file.filename,
      user: req.user?.name ?? "demo.user",
      rapide,
    });
  });

  app.post("/api/imports/fa/demo", async (req) => {
    const buffer = readOfficialFixture(FA_RAPIDE_FIXTURE);
    return importFaBuffer({
      db: deps.db,
      storage: deps.storage,
      buffer,
      fileName: FA_RAPIDE_FIXTURE,
      user: req.user?.name ?? "demo.user",
    });
  });

  app.post("/api/imports/fa", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      reply.code(400).send({ error: "Fichier Excel fiches d'avis manquant" });
      return;
    }
    const buffer = await file.toBuffer();
    return importFaBuffer({
      db: deps.db,
      storage: deps.storage,
      buffer,
      fileName: file.filename,
      user: req.user?.name ?? "demo.user",
    });
  });

  app.get("/api/imports", async () => {
    const rows = await deps.db.all("SELECT * FROM import_batch ORDER BY Id DESC LIMIT 50");
    return { rows };
  });

  app.get("/api/imports/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const batch = await deps.db.get<Record<string, unknown>>("SELECT * FROM import_batch WHERE Id = ?", [id]);
    if (!batch) {
      reply.code(404).send({ error: "Import introuvable" });
      return;
    }
    if (String(batch.Mode) === "fa") {
      const raw = await deps.db.all("SELECT * FROM import_fa_raw WHERE BatchId = ? ORDER BY ligneEXCEL", [id]);
      const errors = (raw as Array<{ erreur: string | null }>).filter((r) => r.erreur);
      return { batch, raw, compare: [], nouveaux: [], errors, kind: "fa" };
    }
    const raw = await deps.db.all("SELECT * FROM import_raw WHERE BatchId = ? ORDER BY ligneEXCEL", [id]);
    const compare = await deps.db.all(
      "SELECT * FROM import_compare WHERE BatchId = ? AND NouveauDocument = 0 ORDER BY GroupeLigne, fieldName",
      [id],
    );
    const nouveaux = await deps.db.all(
      "SELECT * FROM import_compare WHERE BatchId = ? AND NouveauDocument = 1 ORDER BY GroupeLigne, IndiceLigne, fieldName",
      [id],
    );
    const errors = (raw as Array<{ erreur: string | null }>).filter((r) => r.erreur);
    return { batch, raw, compare, nouveaux, errors, kind: "ppd" };
  });

  app.post("/api/imports/:id/apply", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const batch = await deps.db.get<{ Mode: string }>("SELECT Mode FROM import_batch WHERE Id = ?", [id]);
    if (!batch) {
      reply.code(404).send({ error: "Import introuvable" });
      return;
    }
    try {
      if (String(batch.Mode) === "fa") {
        return await applyFaBatch(deps.db, id, req.user?.name ?? "demo.user");
      }
      return await applyImportBatch(deps.db, id, req.user?.name ?? "demo.user");
    } catch (err) {
      reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}

function registerExportRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.post("/api/exports/ppd", async (req, reply) => {
    const body = (req.body ?? {}) as { maskRatp?: boolean };
    const columns = loadBundledImportColumns();
    const snapshots = await loadDocumentSnapshots(deps.db);
    const jalonHeaders = (await listJalons(deps.db)).map((j) => j.code);
    const documents = snapshots.map((s) => ({
      ...s.fields,
      GroupeLigne: s.groupeLigne,
      IndiceLigne: s.indiceLigne,
      jalons: s.jalons.map((j) => ({ nom: j.code, valeur: j.valeur, date: j.date })),
    }));
    let buf: Buffer;
    try {
      const template = await readTemplate(deps.storage, PPD_TEMPLATE_FILE);
      buf = fillOfficialPpdTemplate({
        templateBuffer: template,
        documents,
        columns,
        config: await ppdConfigFromDb(deps.db, false),
        maskRatp: body.maskRatp !== false,
      });
    } catch {
      buf = buildPpdExportWorkbook({
        columns,
        config: await ppdConfigFromDb(deps.db, false),
        documents,
        jalonHeaders,
        maskRatp: body.maskRatp !== false,
      });
    }
    const name = `PPD_MI20_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await deps.storage.write(`EXPORT_PPD/${name}`, buf);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${name}"`)
      .send(buf);
  });
}

function registerBordereauRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/bordereaux", async () => {
    const rows = await deps.db.all(
      `SELECT b.*, (SELECT nom FROM lookup_row WHERE id = b.IdLeader) as LeaderNom,
              (SELECT COUNT(*) FROM envoi e WHERE e.IdBordereau = b.Id) as NbEnvois
       FROM bordereau b ORDER BY Id DESC`,
    );
    return { rows };
  });

  app.post("/api/bordereaux", async (req, reply) => {
    const body = req.body as { idLeader?: number; numero?: number; dateEnvoi?: string; commentaire?: string };
    const leaderId = Number(body.idLeader);
    const leader = await deps.db.get<{ nom: string }>("SELECT nom FROM lookup_row WHERE id = ?", [leaderId]);
    if (!leader) {
      reply.code(400).send({ error: "Leader technique obligatoire" });
      return;
    }
    const numero =
      body.numero ??
      ((await deps.db.get<{ n: number }>("SELECT COALESCE(MAX(Numero), 0) + 1 AS n FROM bordereau WHERE IdLeader = ?", [
        leaderId,
      ]))?.n as number);
    const code = `MI20_BORD_${slug(leader.nom)}_${String(numero).padStart(4, "0")}`;
    const info = await deps.db.run(
      `INSERT INTO bordereau (IdLeader, Numero, DateEnvoi, NomComplet, EstActif, Commentaire)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [leaderId, numero, body.dateEnvoi ?? new Date().toISOString().slice(0, 10), code, body.commentaire ?? null],
    );
    return { id: info.lastInsertId, nomComplet: code, numero };
  });

  app.get("/api/bordereaux/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = await deps.db.get("SELECT * FROM bordereau WHERE Id = ?", [id]);
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    const envois = await deps.db.all(
      `SELECT e.*, d.GroupeLigne, d.IndiceLigne, d.RefExt
       FROM envoi e JOIN document d ON d.Id = e.IdDocument
       WHERE e.IdBordereau = ? ORDER BY e.Id`,
      [id],
    );
    return { bordereau: bx, envois, template: "MI20_BORD_TEMPLATE_M5_V12.xls" };
  });

  app.post("/api/bordereaux/:id/documents", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = await deps.db.get<{ NomComplet: string }>("SELECT * FROM bordereau WHERE Id = ?", [id]);
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    const body = req.body as { documentIds?: number[] };
    const ids = body.documentIds ?? [];
    let attached = 0;
    for (const docId of ids) {
      const doc = await deps.db.get<{ Titre: string; Revision: string }>("SELECT * FROM document WHERE Id = ?", [docId]);
      if (!doc) continue;
      const exists = await deps.db.get("SELECT Id FROM envoi WHERE IdBordereau = ? AND IdDocument = ?", [id, docId]);
      if (exists) continue;
      await deps.db.run(
        `INSERT INTO envoi (IdBordereau, IdDocument, Titre, Revision, NomUtilisateur)
         VALUES (?, ?, ?, ?, ?)`,
        [id, docId, doc.Titre ?? "", doc.Revision ?? "", req.user?.name ?? "demo"],
      );
      attached++;
    }
    return { ok: true, attached };
  });

  app.post("/api/bordereaux/:id/export", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    try {
      const pack = await exportBordereauPack(deps, id);
      return pack;
    } catch (err) {
      reply.code(404).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/bordereaux/:id/download", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = await deps.db.get<{ NomComplet: string; ExportPath: string | null }>(
      "SELECT * FROM bordereau WHERE Id = ?",
      [id],
    );
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    let folder = bx.ExportPath ?? `EXPORT_BX/${bx.NomComplet}`;
    let files = await deps.storage.list(folder);
    if (!files.length) {
      const pack = await exportBordereauPack(deps, id);
      folder = pack.folder;
      files = pack.files;
    }
    const zip = await zipFolder(deps.storage, folder);
    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${bx.NomComplet}.zip"`);
    reply.header("Content-Length", String(zip.length));
    return reply.send(zip);
  });
}

async function exportBordereauPack(deps: AppDeps, id: number): Promise<{ folder: string; files: string[] }> {
  const bx = await deps.db.get<{ NomComplet: string; Numero: number }>("SELECT * FROM bordereau WHERE Id = ?", [id]);
  if (!bx) throw new Error("Bordereau introuvable");
  const envois = await deps.db.all<Record<string, unknown>>(
    `SELECT e.*, d.GroupeLigne, d.IndiceLigne, d.RefExt, d.Titre as DocTitre
     FROM envoi e JOIN document d ON d.Id = e.IdDocument WHERE e.IdBordereau = ?`,
    [id],
  );
  const folder = `EXPORT_BX/${bx.NomComplet}`;
  const manifest = [
    `Template: MI20_BORD_TEMPLATE_M5_V12.xls`,
    `Bordereau: ${bx.NomComplet}`,
    `Envois: ${envois.length}`,
    "",
    "GroupeLigne;IndiceLigne;RefExt;Titre;Revision",
    ...envois.map((e) => `${e.GroupeLigne};${e.IndiceLigne};${e.RefExt};${e.DocTitre};${e.Revision ?? ""}`),
  ].join("\n");
  await deps.storage.write(`${folder}/MANIFEST.txt`, Buffer.from(manifest, "utf8"));
  try {
    const bxTemplate = await readTemplate(deps.storage, BX_TEMPLATE_FILE);
    await deps.storage.write(`${folder}/${BX_TEMPLATE_FILE}`, bxTemplate);
  } catch {
    try {
      await deps.storage.write(`${folder}/${BX_TEMPLATE_FILE}`, readOfficialFixture(BX_TEMPLATE_FILE));
    } catch {
      /* ignore */
    }
  }
  await deps.storage.write(
    `${folder}/README.txt`,
    Buffer.from(
      `Pack bordereau ${bx.NomComplet}\nStructure Access: EXPORT_BX/MI20_BORD_<code>/\nLes PDF livrables se placent dans ce dossier.\n`,
      "utf8",
    ),
  );
  await deps.db.run("UPDATE bordereau SET ExportPath = ? WHERE Id = ?", [folder, id]);
  return { folder, files: await deps.storage.list(folder) };
}

function zipFolder(storage: FileStorage, folder: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    void (async () => {
      const files = await storage.list(folder);
      for (const f of files) {
        const buf = await storage.read(f);
        archive.append(buf, { name: f.replace(`${folder}/`, "") });
      }
      if (!files.length) {
        archive.append(Buffer.from("Pack EXPORT_BX vide.\n", "utf8"), { name: "README.txt" });
      }
      await archive.finalize();
    })().catch(reject);
  });
}

function registerRevisionAndFaRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/revisions", async () => {
    const rows = await deps.db.all(
      `SELECT r.*, d.GroupeLigne, d.IndiceLigne, d.Titre, d.Id as IdDocument
       FROM revision r
       LEFT JOIN programmation_jalon pj ON pj.Id = r.IdProgrammationJalon
       LEFT JOIN document d ON d.Id = COALESCE(r.IdDocument, pj.IdDocument)
       ORDER BY r.Id DESC LIMIT 100`,
    );
    return { rows, stub: false, accessForm: "Form_CREATE_REV" };
  });

  app.post("/api/revisions", async (req, reply) => {
    const body = req.body as { revision?: string; idDocument?: number; commentaire?: string };
    const doc = body.idDocument
      ? await deps.db.get<Record<string, unknown>>("SELECT * FROM document WHERE Id = ?", [body.idDocument])
      : undefined;
    if (!doc) {
      reply.code(400).send({ error: "Document obligatoire" });
      return;
    }
    const label = (body.revision ?? "A").trim() || "A";
    const pj = await deps.db.get<{ Id: number }>(
      "SELECT Id FROM programmation_jalon WHERE IdDocument = ? ORDER BY Id LIMIT 1",
      [Number(doc.Id)],
    );
    const now = new Date().toISOString();
    const ins = await deps.db.run(
      `INSERT INTO revision (Revision, IdProgrammationJalon, NomUtilisateur, EstActive, IdDocument, Commentaire, CreatedAt)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [label, pj?.Id ?? 0, req.user?.name ?? "demo", Number(doc.Id), body.commentaire ?? null, now],
    );
    await deps.db.run("UPDATE document SET Revision = ? WHERE Id = ?", [label, Number(doc.Id)]);
    return deps.db.get("SELECT * FROM revision WHERE Id = ?", [ins.lastInsertId]);
  });

  app.get("/api/ratp-returns", async () => {
    const rows = await listFichesAvis(deps.db);
    return { rows, stub: false, accessForm: "Form_SaisieRetoursRATP" };
  });

  app.post("/api/ratp-returns", async (req, reply) => {
    const body = req.body as { avis?: string; commentaire?: string; idDocument?: number; fichier?: string };
    try {
      const row = await createFicheAvis(deps.db, {
        idDocument: body.idDocument,
        avis: body.avis,
        commentaire: body.commentaire,
        fichier: body.fichier,
        user: req.user?.name ?? "demo.user",
      });
      return row;
    } catch (err) {
      reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/kpi", async () => ({
    stub: false,
    accessForms: ["export_KPI1", "BilanEnvois", "DoctsAutorisation"],
    templates: listTemplates().filter((t) => ["kpi", "bilan", "docts"].includes(t.role)),
    stats: await dbStats(deps.db),
  }));

  app.get("/api/reports", async () => {
    const histo = await deps.db.all("SELECT * FROM doc_histo ORDER BY Id DESC LIMIT 200");
    return { stub: false, accessForm: "Form_REPORT", histo };
  });
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}
