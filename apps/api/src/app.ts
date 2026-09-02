import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import archiver from "archiver";
import {
  buildPpdExportWorkbook,
  DEFAULT_PPD_CONFIG,
  loadBundledImportColumns,
} from "@mi20/domain";
import { authHook, entraClientConfig } from "./auth.js";
import { applyImportBatch, importPpdBuffer, listJalons, loadDocumentSnapshots, ppdConfigFromDb } from "./import-service.js";
import { loadLookupCatalog } from "./seed.js";
import type { FileStorage } from "./storage.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface AppDeps {
  db: Database.Database;
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
    time: new Date().toISOString(),
  }));

  app.get("/api/auth/config", async () => entraClientConfig());

  app.get("/api/meta", async () => {
    const lock = deps.db.prepare("SELECT * FROM app_lock WHERE id = 1").get();
    const project = deps.db.prepare("SELECT value FROM app_config WHERE key = 'projectName'").get() as
      | { value: string }
      | undefined;
    return {
      projectName: project?.value ?? "MI20 Arbo",
      version: "1.0.0",
      inspiredBy: "Access BASE ARBO MI20 IHM 1.6.6",
      lock,
      ppd: DEFAULT_PPD_CONFIG,
      bxTemplate: "MI20_BORD_TEMPLATE_M5_V12.xls",
    };
  });

  app.get("/api/lock", async () => deps.db.prepare("SELECT * FROM app_lock WHERE id = 1").get());
  app.post("/api/lock", async (req) => {
    const body = (req.body ?? {}) as { locked?: boolean; message?: string };
    deps.db
      .prepare(
        "UPDATE app_lock SET locked = ?, message = ?, locked_by = ?, locked_at = datetime('now') WHERE id = 1",
      )
      .run(body.locked ? 1 : 0, body.message ?? null, req.user?.name ?? "demo");
    return deps.db.prepare("SELECT * FROM app_lock WHERE id = 1").get();
  });

  registerDocumentRoutes(app, deps);
  registerLookupRoutes(app, deps);
  registerImportRoutes(app, deps);
  registerExportRoutes(app, deps);
  registerBordereauRoutes(app, deps);
  registerStubRoutes(app, deps);

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
    const pageSize = Math.min(200, Math.max(10, Number(q.pageSize ?? 50)));
    const total = (
      deps.db.prepare(`SELECT COUNT(*) as c FROM document WHERE ${where.join(" AND ")}`).get(...params) as {
        c: number;
      }
    ).c;
    const rows = deps.db
      .prepare(
        `SELECT d.*,
            (SELECT nom FROM lookup_row WHERE id = d.IdFournisseur) as FournisseurNom,
            (SELECT nom FROM lookup_row WHERE id = d.IdDomaineChargeur) as DomaineChargeurNom,
            (SELECT nom FROM lookup_row WHERE id = d.IdLeader) as LeaderNom
         FROM document d
         WHERE ${where.join(" AND ")}
         ORDER BY GroupeLigne, IndiceLigne
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize);
    return { total, page, pageSize, rows };
  });

  app.get("/api/documents/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const doc = deps.db.prepare("SELECT * FROM document WHERE Id = ?").get(id);
    if (!doc) {
      reply.code(404).send({ error: "Document introuvable" });
      return;
    }
    const jalons = deps.db
      .prepare(
        `SELECT pj.*, j.Nom as JalonNom, j.Code as JalonCode
         FROM programmation_jalon pj JOIN jalon j ON j.Id = pj.IdJalon
         WHERE pj.IdDocument = ?`,
      )
      .all(id);
    const histo = deps.db
      .prepare("SELECT * FROM doc_histo WHERE IdDocument = ? ORDER BY Id DESC LIMIT 100")
      .all(id);
    return { document: doc, jalons, histo };
  });

  app.put("/api/documents/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const existing = deps.db.prepare("SELECT * FROM document WHERE Id = ?").get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      reply.code(404).send({ error: "Document introuvable" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const allowed = Object.keys(existing).filter((k) => k !== "Id");
    const sets: string[] = [];
    const params: Record<string, unknown> = { Id: id };
    const now = new Date().toISOString();
    for (const k of allowed) {
      if (!(k in body)) continue;
      const next = body[k];
      if (String(existing[k] ?? "") === String(next ?? "")) continue;
      sets.push(`${k} = @${k}`);
      params[k] = next;
      deps.db
        .prepare(
          `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(
          id,
          existing.GroupeLigne,
          existing.IndiceLigne,
          k,
          String(existing[k] ?? ""),
          String(next ?? ""),
          req.user?.name ?? "demo",
          now,
        );
    }
    if (sets.length) {
      deps.db.prepare(`UPDATE document SET ${sets.join(", ")} WHERE Id = @Id`).run(params);
    }
    return deps.db.prepare("SELECT * FROM document WHERE Id = ?").get(id);
  });
}

function registerLookupRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/lookups", async () => {
    const tables = deps.db.prepare("SELECT table_key, label_fr FROM lookup_table ORDER BY label_fr").all();
    return { tables, catalog: loadLookupCatalog(deps.db) };
  });

  app.get("/api/lookups/:table", async (req) => {
    const table = (req.params as { table: string }).table;
    const rows = deps.db
      .prepare(
        "SELECT id, nom, id_perimetre, id_domaine, id_metier FROM lookup_row WHERE table_key = ? ORDER BY nom",
      )
      .all(table);
    return { table, rows };
  });

  app.post("/api/lookups/:table", async (req, reply) => {
    const table = (req.params as { table: string }).table;
    const body = req.body as { nom?: string; idPerimetre?: number; idDomaine?: number; idMetier?: number };
    if (!body.nom?.trim()) {
      reply.code(400).send({ error: "Nom obligatoire" });
      return;
    }
    const info = deps.db
      .prepare(
        "INSERT INTO lookup_row (table_key, nom, id_perimetre, id_domaine, id_metier) VALUES (?, ?, ?, ?, ?)",
      )
      .run(table, body.nom.trim(), body.idPerimetre ?? null, body.idDomaine ?? null, body.idMetier ?? null);
    return { id: Number(info.lastInsertRowid), nom: body.nom.trim() };
  });

  app.put("/api/lookups/:table/:id", async (req) => {
    const { table, id } = req.params as { table: string; id: string };
    const body = req.body as { nom?: string };
    deps.db.prepare("UPDATE lookup_row SET nom = ? WHERE id = ? AND table_key = ?").run(body.nom, Number(id), table);
    return { ok: true };
  });

  app.delete("/api/lookups/:table/:id", async (req) => {
    const { table, id } = req.params as { table: string; id: string };
    deps.db.prepare("DELETE FROM lookup_row WHERE id = ? AND table_key = ?").run(Number(id), table);
    return { ok: true };
  });

  app.get("/api/jalons", async () => ({ rows: listJalons(deps.db) }));
}

function registerImportRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.post("/api/imports/ppd", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      reply.code(400).send({ error: "Fichier Excel PPD manquant" });
      return;
    }
    const buffer = await file.toBuffer();
    const rapide = (file.fields?.rapide as { value?: string } | undefined)?.value === "true" ||
      (req.query as { rapide?: string }).rapide === "true";
    const result = await importPpdBuffer({
      db: deps.db,
      storage: deps.storage,
      buffer,
      fileName: file.filename,
      user: req.user?.name ?? "demo.user",
      rapide,
    });
    return result;
  });

  app.get("/api/imports", async () => {
    const rows = deps.db.prepare("SELECT * FROM import_batch ORDER BY Id DESC LIMIT 50").all();
    return { rows };
  });

  app.get("/api/imports/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const batch = deps.db.prepare("SELECT * FROM import_batch WHERE Id = ?").get(id);
    if (!batch) {
      reply.code(404).send({ error: "Import introuvable" });
      return;
    }
    const raw = deps.db.prepare("SELECT * FROM import_raw WHERE BatchId = ? ORDER BY ligneEXCEL").all(id);
    const compare = deps.db
      .prepare("SELECT * FROM import_compare WHERE BatchId = ? AND NouveauDocument = 0 ORDER BY GroupeLigne, fieldName")
      .all(id);
    const nouveaux = deps.db
      .prepare(
        "SELECT * FROM import_compare WHERE BatchId = ? AND NouveauDocument = 1 ORDER BY GroupeLigne, IndiceLigne, fieldName",
      )
      .all(id);
    const errors = (raw as Array<{ erreur: string | null }>).filter((r) => r.erreur);
    return { batch, raw, compare, nouveaux, errors };
  });

  app.post("/api/imports/:id/apply", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    try {
      const result = applyImportBatch(deps.db, id, req.user?.name ?? "demo.user");
      return result;
    } catch (err) {
      reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}

function registerExportRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.post("/api/exports/ppd", async (req, reply) => {
    const body = (req.body ?? {}) as { maskRatp?: boolean };
    const columns = loadBundledImportColumns();
    const snapshots = loadDocumentSnapshots(deps.db);
    const jalonHeaders = listJalons(deps.db).map((j) => j.code);
    const documents = snapshots.map((s) => ({
      ...s.fields,
      GroupeLigne: s.groupeLigne,
      IndiceLigne: s.indiceLigne,
      jalons: s.jalons.map((j) => ({ nom: j.code, valeur: j.valeur, date: j.date })),
    }));
    const buf = buildPpdExportWorkbook({
      columns,
      config: ppdConfigFromDb(deps.db, false),
      documents,
      jalonHeaders,
      maskRatp: body.maskRatp !== false,
    });
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
    const rows = deps.db
      .prepare(
        `SELECT b.*, (SELECT nom FROM lookup_row WHERE id = b.IdLeader) as LeaderNom,
                (SELECT COUNT(*) FROM envoi e WHERE e.IdBordereau = b.Id) as NbEnvois
         FROM bordereau b ORDER BY Id DESC`,
      )
      .all();
    return { rows };
  });

  app.post("/api/bordereaux", async (req, reply) => {
    const body = req.body as { idLeader?: number; numero?: number; dateEnvoi?: string; commentaire?: string };
    const leaderId = Number(body.idLeader);
    const leader = deps.db.prepare("SELECT nom FROM lookup_row WHERE id = ?").get(leaderId) as
      | { nom: string }
      | undefined;
    if (!leader) {
      reply.code(400).send({ error: "Leader technique obligatoire" });
      return;
    }
    const numero =
      body.numero ??
      ((
        deps.db.prepare("SELECT COALESCE(MAX(Numero), 0) + 1 AS n FROM bordereau WHERE IdLeader = ?").get(leaderId) as {
          n: number;
        }
      ).n as number);
    const code = `MI20_BORD_${slug(leader.nom)}_${String(numero).padStart(4, "0")}`;
    const info = deps.db
      .prepare(
        `INSERT INTO bordereau (IdLeader, Numero, DateEnvoi, NomComplet, EstActif, Commentaire)
         VALUES (?, ?, ?, ?, 1, ?)`,
      )
      .run(leaderId, numero, body.dateEnvoi ?? new Date().toISOString().slice(0, 10), code, body.commentaire ?? null);
    return { id: Number(info.lastInsertRowid), nomComplet: code, numero };
  });

  app.get("/api/bordereaux/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = deps.db.prepare("SELECT * FROM bordereau WHERE Id = ?").get(id);
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    const envois = deps.db
      .prepare(
        `SELECT e.*, d.GroupeLigne, d.IndiceLigne, d.RefExt
         FROM envoi e JOIN document d ON d.Id = e.IdDocument
         WHERE e.IdBordereau = ? ORDER BY e.Id`,
      )
      .all(id);
    return { bordereau: bx, envois, template: "MI20_BORD_TEMPLATE_M5_V12.xls" };
  });

  app.post("/api/bordereaux/:id/documents", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = deps.db.prepare("SELECT * FROM bordereau WHERE Id = ?").get(id) as { NomComplet: string } | undefined;
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    const body = req.body as { documentIds?: number[] };
    const ids = body.documentIds ?? [];
    const insert = deps.db.prepare(
      `INSERT INTO envoi (IdBordereau, IdDocument, Titre, Revision, NomUtilisateur)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const docId of ids) {
      const doc = deps.db.prepare("SELECT * FROM document WHERE Id = ?").get(docId) as
        | { Titre: string; Revision: string }
        | undefined;
      if (!doc) continue;
      const exists = deps.db
        .prepare("SELECT Id FROM envoi WHERE IdBordereau = ? AND IdDocument = ?")
        .get(id, docId);
      if (exists) continue;
      insert.run(id, docId, doc.Titre ?? "", doc.Revision ?? "", req.user?.name ?? "demo");
    }
    return { ok: true };
  });

  app.post("/api/bordereaux/:id/export", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = deps.db.prepare("SELECT * FROM bordereau WHERE Id = ?").get(id) as
      | { NomComplet: string; Numero: number }
      | undefined;
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    const envois = deps.db
      .prepare(
        `SELECT e.*, d.GroupeLigne, d.IndiceLigne, d.RefExt, d.Titre as DocTitre
         FROM envoi e JOIN document d ON d.Id = e.IdDocument WHERE e.IdBordereau = ?`,
      )
      .all(id) as Array<Record<string, unknown>>;

    const folder = `EXPORT_BX/${bx.NomComplet}`;
    const manifest = [
      `Template: MI20_BORD_TEMPLATE_M5_V12.xls`,
      `Bordereau: ${bx.NomComplet}`,
      `Envois: ${envois.length}`,
      "",
      "GroupeLigne;IndiceLigne;RefExt;Titre;Revision",
      ...envois.map(
        (e) => `${e.GroupeLigne};${e.IndiceLigne};${e.RefExt};${e.DocTitre};${e.Revision ?? ""}`,
      ),
    ].join("\n");
    await deps.storage.write(`${folder}/MANIFEST.txt`, Buffer.from(manifest, "utf8"));
    await deps.storage.write(
      `${folder}/README.txt`,
      Buffer.from(
        `Pack bordereau ${bx.NomComplet}\nStructure Access: EXPORT_BX/MI20_BORD_<code>/\nLes PDF livrables se placent dans ce dossier.\n`,
        "utf8",
      ),
    );
    deps.db.prepare("UPDATE bordereau SET ExportPath = ? WHERE Id = ?").run(folder, id);
    return { folder, files: await deps.storage.list(folder) };
  });

  app.get("/api/bordereaux/:id/download", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bx = deps.db.prepare("SELECT * FROM bordereau WHERE Id = ?").get(id) as
      | { NomComplet: string; ExportPath: string | null }
      | undefined;
    if (!bx) {
      reply.code(404).send({ error: "Bordereau introuvable" });
      return;
    }
    const folder = bx.ExportPath ?? `EXPORT_BX/${bx.NomComplet}`;
    const files = await deps.storage.list(folder);
    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${bx.NomComplet}.zip"`);
    const archive = archiver("zip");
    reply.send(archive);
    for (const f of files) {
      const buf = await deps.storage.read(f);
      archive.append(buf, { name: f.replace(`${folder}/`, "") });
    }
    await archive.finalize();
  });
}

function registerStubRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/api/revisions", async () => {
    const rows = deps.db.prepare("SELECT * FROM revision ORDER BY Id DESC LIMIT 50").all();
    return { rows, stub: true, accessForm: "Form_CREATE_REV" };
  });
  app.get("/api/ratp-returns", async () => ({
    rows: [],
    stub: true,
    accessForm: "Form_SaisieRetoursRATP",
  }));
  app.get("/api/kpi", async () => ({
    stub: true,
    templates: ["KPI1_Template.xlsm", "BilanEnvois_Template.xlsx", "DoctsAutorisation_Template.xlsx"],
  }));
  app.get("/api/reports", async () => {
    const histo = deps.db.prepare("SELECT * FROM doc_histo ORDER BY Id DESC LIMIT 100").all();
    return { stub: true, accessForm: "Form_REPORT", histo };
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
