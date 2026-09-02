import {
  BX_TEMPLATE_FILE,
  DEFAULT_PPD_CONFIG,
  DEFAULT_RAPIDE_FIXTURE,
  JALONS_RAPIDE_FIXTURE,
  OFFICIAL_TEMPLATES,
  PPD_TEMPLATE_SMALL_FILE,
  computeDifferences,
  fillOfficialPpdTemplate,
  isOfficialTemplateName,
  jalonsToRawFields,
  matchJalonDef,
  parseImportColumnsCsv,
  parsePpdSheet,
  parseWorkbookToAoa,
  type DocumentSnapshot,
  type ImportColumn,
} from "@mi20/domain/browser";
import importColumnsCsv from "../../../../packages/domain/data/import_columns.csv?raw";
import {
  b64ToBytes,
  bytesToB64,
  getState,
  loadLookupCatalog,
  lookupName,
  nextId,
  saveState,
  type DocumentRow,
} from "./store";
import { zipStore } from "./zip";

export class DemoHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const columns: ImportColumn[] = parseImportColumnsCsv(importColumnsCsv);

function origFetch(): typeof fetch {
  const w = window as unknown as { __mi20OrigFetch?: typeof fetch };
  return w.__mi20OrigFetch ?? window.fetch.bind(window);
}

function fixtureHref(fileName: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}demo-fixtures/${fileName}`;
}

async function loadFixtureBytes(fileName: string): Promise<Uint8Array> {
  if (!isOfficialTemplateName(fileName)) throw new DemoHttpError("Fichier template non autorisé", 400);
  const res = await origFetch()(fixtureHref(fileName));
  if (!res.ok) throw new DemoHttpError(`Fixture ${fileName} introuvable (${res.status})`, 404);
  return new Uint8Array(await res.arrayBuffer());
}

const DOCUMENT_FIELDS = new Set([
  "RefExt",
  "Revision",
  "Livrable",
  "Titre",
  "Nom",
  "Sections",
  "Poste",
  "RefExtParent",
  "RefDocumentSource",
  "RefPDMdocFNR",
  "CommentaireBT",
  "Tranche",
  "SiteEmetteur",
  "N_MF19",
  "EffMateriel",
  "LignePPDCouverteParAutreNumero",
  "DateResoumission",
  "Langue",
  "Projet",
  "Metier",
  "QteEstimeeDocs",
  "RelecturePartenaire",
  "IdLeader",
  "IdCoediteur",
  "IdCategorie",
  "IdCategorieAT",
  "IdDomaineBord",
  "IdFournisseur",
  "IdTypeDossier",
  "IdOrigine",
  "IdLogicielCAO",
  "IdModeleCAO",
  "IdResponsable",
  "IdDomaineChargeur",
  "IdMetier",
  "IDPic",
  "IdPicSupport",
  "IDPerimetre",
  "IdProduit",
  "IdNiveauConfidentialite",
  "IdNiveauCommunication",
  "IdPourInfo_Acceptation",
  "IdPreuveAutorisation",
  "IdTypeCode",
  "IdTypeEnvoi",
  "EstConfidentiel",
  "EstSecuritaire",
  "DelivrableProjet",
  "Homologuant",
  "RFA",
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function binary(data: Uint8Array, contentType: string, filename: string): Response {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Response(new Blob([copy], { type: contentType }), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function listJalons() {
  return getState().jalons.map((j) => ({ id: j.Id, nom: j.Nom, code: j.Code }));
}

function documentSnapshots(): DocumentSnapshot[] {
  const s = getState();
  return s.documents.map((d) => ({
    id: d.Id,
    groupeLigne: Number(d.GroupeLigne),
    indiceLigne: String(d.IndiceLigne ?? ""),
    fields: d,
    jalons: s.programmation
      .filter((p) => p.IdDocument === d.Id)
      .map((p) => {
        const def = s.jalons.find((j) => j.Id === p.IdJalon);
        return {
          idJalon: p.IdJalon,
          code: def?.Code ?? p.Code,
          nom: def?.Nom ?? p.Code,
          valeur: p.Version,
          date: p.DatePrevisionnelle,
          estPrevisionnel: Boolean(p.EstPrevisionnel),
          idVersion: p.IdVersion,
        };
      }),
  }));
}

function decorateDoc(d: DocumentRow) {
  return {
    ...d,
    FournisseurNom: lookupName(d.IdFournisseur as number),
    DomaineChargeurNom: lookupName(d.IdDomaineChargeur as number),
    LeaderNom: lookupName(d.IdLeader as number),
  };
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

function remapDocumentAliases(payload: Record<string, unknown>): void {
  if (payload.IdPIC !== undefined) payload.IDPic = payload.IdPIC;
  if (payload.IdPICSupport !== undefined) payload.IdPicSupport = payload.IdPICSupport;
  if (payload.IdPerimetre !== undefined) payload.IDPerimetre = payload.IdPerimetre;
  if (payload.estConfidentiel !== undefined) payload.EstConfidentiel = payload.estConfidentiel;
}

async function importPpd(buffer: Uint8Array, fileName: string, rapide: boolean) {
  const s = getState();
  const aoa = parseWorkbookToAoa(buffer);
  const parsed = parsePpdSheet(aoa, columns, loadLookupCatalog(), { ...DEFAULT_PPD_CONFIG, rapide });
  const diffs = computeDifferences({
    staged: parsed.rows,
    existing: documentSnapshots(),
    columns,
    lookups: loadLookupCatalog(),
    jalons: listJalons(),
  });
  const now = new Date().toISOString();
  const errorCount = parsed.rows.filter((r) => r.errors.length).length;
  const newCount = parsed.rows.filter((r) => r.isNew).length;
  const batchId = nextId();
  s.importBatches.push({
    Id: batchId,
    ImportUser: "demo.user",
    ImportTime: now,
    FileName: fileName,
    Mode: parsed.mode,
    Status: "staged",
    Warning: parsed.warnings.join("\n"),
    RowCount: parsed.rows.length,
    ErrorCount: errorCount,
  });
  const jalons = listJalons();
  for (const row of parsed.rows) {
    s.importRaw.push({
      Id: nextId(),
      BatchId: batchId,
      ImportUser: "demo.user",
      ImportTime: now,
      GroupeLigne: row.groupeLigne,
      IndiceLigne: row.indiceLigne,
      ligneEXCEL: row.ligneExcel,
      erreur: row.errors.join("\n") || null,
      NouveauDocument: row.isNew ? 1 : 0,
      payload_json: JSON.stringify({ ...row.fields, ...jalonsToRawFields(row.jalons), display: row.displayFields }),
      jalon_json: JSON.stringify(row.jalons),
    });
    for (const slot of row.jalons) {
      matchJalonDef(slot, jalons);
    }
  }
  for (const d of diffs) {
    s.importCompare.push({
      Id: nextId(),
      BatchId: batchId,
      GroupeLigne: d.groupeLigne,
      IndiceLigne: d.indiceLigne,
      titre_fr: d.titreFr,
      fieldName: d.fieldName,
      fieldLabel: d.fieldLabel,
      oldValue: d.oldValue,
      newValue: d.newValue,
      isImported: 0,
      NouveauDocument: d.nouveauDocument ? 1 : 0,
      table: d.table,
      oldValue_brut: d.oldValueBrut,
      newValue_brut: d.newValueBrut,
      oldEstPrevisionnel: d.oldEstPrevisionnel ? 1 : 0,
      newEstPrevisionnel: d.newEstPrevisionnel ? 1 : 0,
    });
  }
  s.files[`IMPORT_PPD/${batchId}_${fileName}`] = {
    type: "application/octet-stream",
    b64: bytesToB64(buffer),
  };
  saveState();
  return {
    batchId,
    rowCount: parsed.rows.length,
    errorCount,
    newCount,
    diffCount: diffs.length,
    warnings: parsed.warnings,
  };
}

function applyImport(batchId: number) {
  const s = getState();
  const batch = s.importBatches.find((b) => b.Id === batchId);
  if (!batch) throw new DemoHttpError("Lot d'import introuvable", 404);
  const raws = s.importRaw.filter((r) => r.BatchId === batchId);
  const now = new Date().toISOString();
  let appliedDocuments = 0;
  let appliedJalons = 0;
  for (const raw of raws) {
    if (raw.erreur) continue;
    const payload = JSON.parse(String(raw.payload_json ?? "{}")) as Record<string, unknown>;
    remapDocumentAliases(payload);
    const existing = s.documents.find(
      (d) => Number(d.GroupeLigne) === Number(raw.GroupeLigne) && String(d.IndiceLigne) === String(raw.IndiceLigne),
    );
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (DOCUMENT_FIELDS.has(k)) fields[k] = v;
    }
    fields.GroupeLigne = raw.GroupeLigne;
    fields.IndiceLigne = raw.IndiceLigne;
    if (!fields.RefExt) fields.RefExt = existing?.RefExt ?? "";
    if (!fields.Revision) fields.Revision = existing?.Revision ?? "";
    if (!fields.Livrable) fields.Livrable = existing?.Livrable ?? "";
    if (fields.EffMateriel === undefined || fields.EffMateriel === null) {
      fields.EffMateriel = existing?.EffMateriel ?? "";
    }

    let docId: number;
    if (!existing) {
      docId = nextId();
      s.documents.push({ Id: docId, ...fields });
      appliedDocuments++;
      s.histo.push({
        Id: nextId(),
        IdDocument: docId,
        GroupeLigne: raw.GroupeLigne,
        IndiceLigne: raw.IndiceLigne,
        FieldName: "_nouveau",
        OldValue: "",
        NewValue: "import",
        UserName: "demo.user",
        ChangedAt: now,
        IsImport: 1,
      });
    } else {
      docId = existing.Id;
      let changed = false;
      for (const [k, v] of Object.entries(fields)) {
        if (k === "GroupeLigne" || k === "IndiceLigne") continue;
        if (String(existing[k] ?? "") === String(v ?? "")) continue;
        s.histo.push({
          Id: nextId(),
          IdDocument: docId,
          GroupeLigne: raw.GroupeLigne,
          IndiceLigne: raw.IndiceLigne,
          FieldName: k,
          OldValue: String(existing[k] ?? ""),
          NewValue: String(v ?? ""),
          UserName: "demo.user",
          ChangedAt: now,
          IsImport: 1,
        });
        existing[k] = v;
        changed = true;
      }
      if (changed) appliedDocuments++;
    }

    const jalons = raw.jalon_json
      ? (JSON.parse(String(raw.jalon_json)) as Array<{
          index?: number;
          nom: string;
          valeur: string;
          date: string | null;
          estPrevisionnel: boolean;
        }>)
      : [];
    const defs = listJalons();
    for (const slot of jalons) {
      const def = matchJalonDef(
        {
          index: slot.index ?? 0,
          nom: slot.nom,
          valeur: slot.valeur,
          date: slot.date,
          estPrevisionnel: slot.estPrevisionnel,
        },
        defs,
      );
      if (!def) continue;
      const found = s.programmation.find((p) => p.IdDocument === docId && p.IdJalon === def.id);
      if (found) {
        found.EstPrevisionnel = slot.estPrevisionnel ? 1 : 0;
        found.DatePrevisionnelle = slot.date;
        found.Version = slot.valeur;
        found.Code = def.code;
        found.Revision = (fields.Revision as string) ?? null;
      } else {
        s.programmation.push({
          Id: nextId(),
          IdDocument: docId,
          IdJalon: def.id,
          IdVersion: 0,
          EstPrevisionnel: slot.estPrevisionnel ? 1 : 0,
          DatePrevisionnelle: slot.date,
          Version: slot.valeur,
          Code: def.code,
          Revision: (fields.Revision as string) ?? null,
        });
      }
      appliedJalons++;
    }
  }
  for (const c of s.importCompare.filter((r) => r.BatchId === batchId)) c.isImported = 1;
  batch.Status = "applied";
  saveState();
  return { appliedDocuments, appliedJalons };
}

async function readJson(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body) return {};
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function routeParam(match: RegExpMatchArray, index: number): string {
  const value = match[index];
  if (value == null) throw new DemoHttpError("Route invalide", 400);
  return decodeURIComponent(value);
}

export async function handleDemoApi(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const q = url.searchParams;
  const s = getState();

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, name: "MI20 Arbo", storage: "browser-demo", time: new Date().toISOString() });
  }
  if (path === "/api/auth/config" && method === "GET") {
    return json({ authDisabled: true, clientId: "", tenantId: "", apiScope: "", redirectUri: "" });
  }
  if (path === "/api/meta" && method === "GET") {
    return json({
      projectName: "MI20 Arbo",
      version: "1.0.0",
      inspiredBy: "Access BASE ARBO MI20 IHM 1.6.6",
      lock: s.lock,
      ppd: DEFAULT_PPD_CONFIG,
      bxTemplate: BX_TEMPLATE_FILE,
      defaultImportFixture: DEFAULT_RAPIDE_FIXTURE,
      templates: OFFICIAL_TEMPLATES,
      publicDemo: true,
    });
  }
  if (path === "/api/lock" && method === "GET") return json(s.lock);
  if (path === "/api/lock" && method === "POST") {
    const body = await readJson(init);
    s.lock.locked = body.locked ? 1 : 0;
    s.lock.message = (body.message as string | null) ?? null;
    s.lock.locked_by = "demo.user";
    s.lock.locked_at = new Date().toISOString();
    saveState();
    return json(s.lock);
  }

  if (path === "/api/documents" && method === "GET") {
    const search = (q.get("search") ?? "").toLowerCase();
    const groupeLigne = q.get("groupeLigne");
    const indiceLigne = q.get("indiceLigne");
    const fournisseurId = q.get("fournisseurId");
    const domaineChargeurId = q.get("domaineChargeurId");
    const revision = q.get("revision");
    let rows = s.documents.filter((d) => {
      if (search) {
        const hay = `${d.Titre ?? ""} ${d.RefExt ?? ""} ${d.GroupeLigne ?? ""} ${d.IndiceLigne ?? ""} ${d.Livrable ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (groupeLigne && Number(d.GroupeLigne) !== Number(groupeLigne)) return false;
      if (indiceLigne && String(d.IndiceLigne) !== indiceLigne) return false;
      if (fournisseurId && Number(d.IdFournisseur) !== Number(fournisseurId)) return false;
      if (domaineChargeurId && Number(d.IdDomaineChargeur) !== Number(domaineChargeurId)) return false;
      if (revision && String(d.Revision) !== revision) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => Number(a.GroupeLigne) - Number(b.GroupeLigne) || String(a.IndiceLigne).localeCompare(String(b.IndiceLigne)));
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(10, Number(q.get("pageSize") ?? 50)));
    const total = rows.length;
    const sliced = rows.slice((page - 1) * pageSize, page * pageSize).map(decorateDoc);
    return json({ total, page, pageSize, rows: sliced });
  }

  const docMatch = path.match(/^\/api\/documents\/(\d+)$/);
  if (docMatch && method === "GET") {
    const id = Number(docMatch[1]);
    const doc = s.documents.find((d) => d.Id === id);
    if (!doc) throw new DemoHttpError("Document introuvable", 404);
    const jalons = s.programmation
      .filter((p) => p.IdDocument === id)
      .map((p) => {
        const def = s.jalons.find((j) => j.Id === p.IdJalon);
        return { ...p, JalonNom: def?.Nom, JalonCode: def?.Code };
      });
    const histo = s.histo.filter((h) => h.IdDocument === id).slice(-100).reverse();
    return json({ document: doc, jalons, histo });
  }
  if (docMatch && method === "PUT") {
    const id = Number(docMatch[1]);
    const existing = s.documents.find((d) => d.Id === id);
    if (!existing) throw new DemoHttpError("Document introuvable", 404);
    const body = await readJson(init);
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(body)) {
      if (k === "Id") continue;
      if (String(existing[k] ?? "") === String(v ?? "")) continue;
      s.histo.push({
        Id: nextId(),
        IdDocument: id,
        GroupeLigne: existing.GroupeLigne,
        IndiceLigne: existing.IndiceLigne,
        FieldName: k,
        OldValue: String(existing[k] ?? ""),
        NewValue: String(v ?? ""),
        UserName: "demo.user",
        ChangedAt: now,
        IsImport: 0,
      });
      existing[k] = v;
    }
    saveState();
    return json(existing);
  }

  if (path === "/api/lookups" && method === "GET") {
    return json({
      tables: [...s.lookupTables].sort((a, b) => a.label_fr.localeCompare(b.label_fr)),
      catalog: loadLookupCatalog(),
    });
  }
  const lookupTable = path.match(/^\/api\/lookups\/([^/]+)$/);
  if (lookupTable && method === "GET") {
    const table = routeParam(lookupTable, 1);
    const rows = s.lookupRows
      .filter((r) => r.table_key === table)
      .map((r) => ({
        id: r.id,
        nom: r.nom,
        id_perimetre: r.id_perimetre,
        id_domaine: r.id_domaine,
        id_metier: r.id_metier,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
    return json({ table, rows });
  }
  if (lookupTable && method === "POST") {
    const table = routeParam(lookupTable, 1);
    const body = await readJson(init);
    const nom = String(body.nom ?? "").trim();
    if (!nom) throw new DemoHttpError("Nom obligatoire", 400);
    const id = nextId();
    s.lookupRows.push({
      id,
      table_key: table,
      nom,
      id_perimetre: (body.idPerimetre as number) ?? null,
      id_domaine: (body.idDomaine as number) ?? null,
      id_metier: (body.idMetier as number) ?? null,
    });
    saveState();
    return json({ id, nom });
  }
  const lookupRow = path.match(/^\/api\/lookups\/([^/]+)\/(\d+)$/);
  if (lookupRow && method === "PUT") {
    const table = routeParam(lookupRow, 1);
    const id = Number(lookupRow[2]);
    const body = await readJson(init);
    const row = s.lookupRows.find((r) => r.id === id && r.table_key === table);
    if (row && body.nom) row.nom = String(body.nom);
    saveState();
    return json({ ok: true });
  }
  if (lookupRow && method === "DELETE") {
    const table = routeParam(lookupRow, 1);
    const id = Number(lookupRow[2]);
    s.lookupRows = s.lookupRows.filter((r) => !(r.id === id && r.table_key === table));
    saveState();
    return json({ ok: true });
  }

  if (path === "/api/jalons" && method === "GET") return json({ rows: listJalons() });
  if (path === "/api/templates" && method === "GET") {
    return json({ rows: OFFICIAL_TEMPLATES.map((t) => ({ ...t, available: true })) });
  }
  const tpl = path.match(/^\/api\/templates\/(.+)$/);
  if (tpl && method === "GET") {
    const file = routeParam(tpl, 1);
    const bytes = await loadFixtureBytes(file);
    return binary(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file);
  }

  if (path === "/api/imports/ppd/demo" && method === "POST") {
    const fileName = q.get("file") === JALONS_RAPIDE_FIXTURE ? JALONS_RAPIDE_FIXTURE : DEFAULT_RAPIDE_FIXTURE;
    const rapide = q.get("rapide") !== "false";
    const buffer = await loadFixtureBytes(fileName);
    return json(await importPpd(buffer, fileName, rapide || fileName === JALONS_RAPIDE_FIXTURE));
  }
  if (path === "/api/imports/ppd" && method === "POST") {
    if (!(init?.body instanceof FormData)) throw new DemoHttpError("Fichier Excel PPD manquant", 400);
    const file = init.body.get("file");
    if (!(file instanceof File)) throw new DemoHttpError("Fichier Excel PPD manquant", 400);
    const rapide = String(init.body.get("rapide") ?? q.get("rapide") ?? "") === "true";
    const buffer = new Uint8Array(await file.arrayBuffer());
    return json(await importPpd(buffer, file.name, rapide));
  }
  if (path === "/api/imports" && method === "GET") {
    return json({ rows: [...s.importBatches].sort((a, b) => Number(b.Id) - Number(a.Id)).slice(0, 50) });
  }
  const importId = path.match(/^\/api\/imports\/(\d+)$/);
  if (importId && method === "GET") {
    const id = Number(importId[1]);
    const batch = s.importBatches.find((b) => b.Id === id);
    if (!batch) throw new DemoHttpError("Import introuvable", 404);
    const raw = s.importRaw.filter((r) => r.BatchId === id).sort((a, b) => Number(a.ligneEXCEL) - Number(b.ligneEXCEL));
    const compare = s.importCompare.filter((r) => r.BatchId === id && r.NouveauDocument === 0);
    const nouveaux = s.importCompare.filter((r) => r.BatchId === id && r.NouveauDocument === 1);
    const errors = raw.filter((r) => r.erreur);
    return json({ batch, raw, compare, nouveaux, errors });
  }
  const apply = path.match(/^\/api\/imports\/(\d+)\/apply$/);
  if (apply && method === "POST") {
    return json(applyImport(Number(apply[1])));
  }

  if (path === "/api/exports/ppd" && method === "POST") {
    const body = await readJson(init);
    const snapshots = documentSnapshots();
    const jalonHeaders = listJalons().map((j) => j.code);
    const documents = snapshots.map((snap) => ({
      ...snap.fields,
      GroupeLigne: snap.groupeLigne,
      IndiceLigne: snap.indiceLigne,
      jalons: snap.jalons.map((j) => ({ nom: j.code, valeur: j.valeur, date: j.date })),
    }));
    let buf: Uint8Array;
    try {
      const template = await loadFixtureBytes(PPD_TEMPLATE_SMALL_FILE);
      buf = toUint8(
        fillOfficialPpdTemplate({
          templateBuffer: template,
          documents,
          columns,
          config: { ...DEFAULT_PPD_CONFIG, rapide: false },
          maskRatp: body.maskRatp !== false,
        }),
      );
    } catch {
      const { buildPpdExportWorkbook } = await import("@mi20/domain/browser");
      buf = toUint8(
        buildPpdExportWorkbook({
          columns,
          config: { ...DEFAULT_PPD_CONFIG, rapide: false },
          documents,
          jalonHeaders,
          maskRatp: body.maskRatp !== false,
        }),
      );
    }
    const name = `PPD_MI20_${new Date().toISOString().slice(0, 10)}.xlsx`;
    s.files[`EXPORT_PPD/${name}`] = { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b64: bytesToB64(buf) };
    saveState();
    return binary(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
  }

  if (path === "/api/bordereaux" && method === "GET") {
    const rows = [...s.bordereaux]
      .sort((a, b) => Number(b.Id) - Number(a.Id))
      .map((b) => ({
        ...b,
        LeaderNom: lookupName(b.IdLeader as number),
        NbEnvois: s.envois.filter((e) => e.IdBordereau === b.Id).length,
      }));
    return json({ rows });
  }
  if (path === "/api/bordereaux" && method === "POST") {
    const body = await readJson(init);
    const leaderId = Number(body.idLeader);
    const leader = s.lookupRows.find((r) => r.id === leaderId);
    if (!leader) throw new DemoHttpError("Leader technique obligatoire", 400);
    const existingNums = s.bordereaux.filter((b) => b.IdLeader === leaderId).map((b) => Number(b.Numero) || 0);
    const numero = body.numero != null ? Number(body.numero) : Math.max(0, ...existingNums) + 1;
    const code = `MI20_BORD_${slug(leader.nom)}_${String(numero).padStart(4, "0")}`;
    const id = nextId();
    s.bordereaux.push({
      Id: id,
      IdLeader: leaderId,
      Numero: numero,
      DateEnvoi: (body.dateEnvoi as string) ?? new Date().toISOString().slice(0, 10),
      NomComplet: code,
      EstActif: 1,
      Commentaire: body.commentaire ?? null,
      ExportPath: null,
    });
    saveState();
    return json({ id, nomComplet: code, numero });
  }
  const bxId = path.match(/^\/api\/bordereaux\/(\d+)$/);
  if (bxId && method === "GET") {
    const id = Number(bxId[1]);
    const bx = s.bordereaux.find((b) => b.Id === id);
    if (!bx) throw new DemoHttpError("Bordereau introuvable", 404);
    const envois = s.envois
      .filter((e) => e.IdBordereau === id)
      .map((e) => {
        const d = s.documents.find((doc) => doc.Id === e.IdDocument);
        return { ...e, GroupeLigne: d?.GroupeLigne, IndiceLigne: d?.IndiceLigne, RefExt: d?.RefExt };
      });
    return json({ bordereau: bx, envois, template: BX_TEMPLATE_FILE });
  }
  const bxDocs = path.match(/^\/api\/bordereaux\/(\d+)\/documents$/);
  if (bxDocs && method === "POST") {
    const id = Number(bxDocs[1]);
    const bx = s.bordereaux.find((b) => b.Id === id);
    if (!bx) throw new DemoHttpError("Bordereau introuvable", 404);
    const body = await readJson(init);
    const ids = (body.documentIds as number[]) ?? [];
    for (const docId of ids) {
      const doc = s.documents.find((d) => d.Id === Number(docId));
      if (!doc) continue;
      if (s.envois.some((e) => e.IdBordereau === id && e.IdDocument === doc.Id)) continue;
      s.envois.push({
        Id: nextId(),
        IdBordereau: id,
        IdDocument: doc.Id,
        Titre: doc.Titre ?? "",
        Revision: doc.Revision ?? "",
        NomUtilisateur: "demo.user",
      });
    }
    saveState();
    return json({ ok: true });
  }
  const bxExport = path.match(/^\/api\/bordereaux\/(\d+)\/export$/);
  if (bxExport && method === "POST") {
    const id = Number(bxExport[1]);
    const bx = s.bordereaux.find((b) => b.Id === id);
    if (!bx) throw new DemoHttpError("Bordereau introuvable", 404);
    const envois = s.envois.filter((e) => e.IdBordereau === id);
    const folder = `EXPORT_BX/${bx.NomComplet}`;
    const lines = [
      `Template: ${BX_TEMPLATE_FILE}`,
      `Bordereau: ${bx.NomComplet}`,
      `Envois: ${envois.length}`,
      "",
      "GroupeLigne;IndiceLigne;RefExt;Titre;Revision",
      ...envois.map((e) => {
        const d = s.documents.find((doc) => doc.Id === e.IdDocument);
        return `${d?.GroupeLigne ?? ""};${d?.IndiceLigne ?? ""};${d?.RefExt ?? ""};${d?.Titre ?? e.Titre};${e.Revision ?? ""}`;
      }),
    ].join("\n");
    const encoder = new TextEncoder();
    s.files[`${folder}/MANIFEST.txt`] = { type: "text/plain", b64: bytesToB64(encoder.encode(lines)) };
    try {
      const tplBytes = await loadFixtureBytes(BX_TEMPLATE_FILE);
      s.files[`${folder}/${BX_TEMPLATE_FILE}`] = { type: "application/vnd.ms-excel", b64: bytesToB64(tplBytes) };
    } catch {
      /* optional */
    }
    s.files[`${folder}/README.txt`] = {
      type: "text/plain",
      b64: bytesToB64(
        encoder.encode(
          `Pack bordereau ${bx.NomComplet}\nStructure Access: EXPORT_BX/MI20_BORD_<code>/\nLes PDF livrables se placent dans ce dossier.\nDémo navigateur (données en mémoire / localStorage).\n`,
        ),
      ),
    };
    bx.ExportPath = folder;
    saveState();
    const files = Object.keys(s.files).filter((f) => f.startsWith(`${folder}/`));
    return json({ folder, files });
  }
  const bxDl = path.match(/^\/api\/bordereaux\/(\d+)\/download$/);
  if (bxDl && method === "GET") {
    const id = Number(bxDl[1]);
    const bx = s.bordereaux.find((b) => b.Id === id);
    if (!bx) throw new DemoHttpError("Bordereau introuvable", 404);
    const folder = String(bx.ExportPath ?? `EXPORT_BX/${bx.NomComplet}`);
    const entries = Object.entries(s.files)
      .filter(([name]) => name.startsWith(`${folder}/`))
      .map(([name, file]) => ({ name: name.replace(`${folder}/`, ""), data: b64ToBytes(file.b64) }));
    if (!entries.length) throw new DemoHttpError("Pack non généré — exportez d'abord.", 400);
    const zip = zipStore(entries);
    return binary(zip, "application/zip", `${bx.NomComplet}.zip`);
  }

  if (path === "/api/revisions" && method === "GET") {
    return json({ rows: s.revisions, stub: true, accessForm: "Form_CREATE_REV" });
  }
  if (path === "/api/revisions" && method === "POST") {
    const body = await readJson(init);
    const id = nextId();
    const row = {
      Id: id,
      Revision: String(body.revision ?? "A"),
      IdDocument: body.idDocument ?? null,
      NomUtilisateur: "demo.user",
      EstActive: 1,
      Commentaire: body.commentaire ?? null,
      CreatedAt: new Date().toISOString(),
    };
    s.revisions.push(row);
    saveState();
    return json(row);
  }
  if (path === "/api/ratp-returns" && method === "GET") {
    return json({ rows: s.ratpReturns, stub: true, accessForm: "Form_SaisieRetoursRATP" });
  }
  if (path === "/api/ratp-returns" && method === "POST") {
    const body = await readJson(init);
    const id = nextId();
    const row = {
      Id: id,
      IdDocument: body.idDocument ?? null,
      Avis: String(body.avis ?? "FA"),
      Commentaire: String(body.commentaire ?? ""),
      NomUtilisateur: "demo.user",
      CreatedAt: new Date().toISOString(),
    };
    s.ratpReturns.push(row);
    saveState();
    return json(row);
  }
  if (path === "/api/kpi" && method === "GET") {
    return json({ stub: true, templates: OFFICIAL_TEMPLATES.filter((t) => ["kpi", "bilan", "docts"].includes(t.role)) });
  }
  if (path === "/api/reports" && method === "GET") {
    return json({ stub: true, accessForm: "Form_REPORT", histo: [...s.histo].slice(-100).reverse() });
  }

  throw new DemoHttpError(`API démo : ${method} ${path} non géré`, 404);
}

function toUint8(data: Buffer | Uint8Array | ArrayBuffer): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}
