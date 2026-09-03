import {
  computeDifferences,
  DEFAULT_PPD_CONFIG,
  jalonsToRawFields,
  loadBundledImportColumns,
  matchJalonDef,
  parsePpdSheet,
  parseWorkbookToAoa,
  type DocumentSnapshot,
  type PpdConfig,
} from "@mi20/domain";
import { loadLookupCatalog } from "./seed.js";
import type { FileStorage } from "./storage.js";
import type { SqlDatabase } from "./sql.js";

export async function ppdConfigFromDb(db: SqlDatabase, rapide: boolean): Promise<PpdConfig> {
  const get = async (k: string, d: string) => {
    const row = await db.get<{ value: string }>("SELECT value FROM app_config WHERE key = ?", [k]);
    return row?.value ?? d;
  };
  return {
    ...DEFAULT_PPD_CONFIG,
    firstColumnTitle: await get("titrePremiereColonneXLS_PPD", DEFAULT_PPD_CONFIG.firstColumnTitle),
    firstColumnTitleRapide: await get(
      "titrePremiereColonneXLS_PPD_rapide",
      DEFAULT_PPD_CONFIG.firstColumnTitleRapide,
    ),
    jalonCount: Number(await get("nbJalonsPPD", "23")),
    ratpMaskedColumns: (await get("exportRatpMask", "C,AA,AB,AC"))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rapide,
  };
}

export async function listJalons(db: SqlDatabase) {
  return db.all<{ id: number; nom: string; code: string }>(
    "SELECT Id as id, Nom as nom, Code as code FROM jalon ORDER BY Id",
  );
}

export async function loadDocumentSnapshots(db: SqlDatabase): Promise<DocumentSnapshot[]> {
  const docs = await db.all<Record<string, unknown>>("SELECT * FROM document");
  const jalons = await db.all<Record<string, unknown>>(
    `SELECT pj.*, j.Code as jalonCode, j.Nom as jalonNom
     FROM programmation_jalon pj JOIN jalon j ON j.Id = pj.IdJalon`,
  );
  const byDoc = new Map<number, typeof jalons>();
  for (const j of jalons) {
    const id = Number(j.IdDocument);
    const list = byDoc.get(id) ?? [];
    list.push(j);
    byDoc.set(id, list);
  }
  return docs.map((d) => ({
    id: Number(d.Id),
    groupeLigne: Number(d.GroupeLigne),
    indiceLigne: String(d.IndiceLigne ?? ""),
    fields: d,
    jalons: (byDoc.get(Number(d.Id)) ?? []).map((j) => ({
      idJalon: Number(j.IdJalon),
      code: String(j.jalonCode ?? j.Code ?? ""),
      nom: String(j.jalonNom ?? ""),
      valeur: String(j.Version ?? ""),
      date: (j.DatePrevisionnelle as string) ?? null,
      estPrevisionnel: Boolean(j.EstPrevisionnel),
      idVersion: Number(j.IdVersion ?? 0),
    })),
  }));
}

export async function importPpdBuffer(args: {
  db: SqlDatabase;
  storage: FileStorage;
  buffer: Buffer;
  fileName: string;
  user: string;
  rapide: boolean;
}): Promise<{
  batchId: number;
  rowCount: number;
  errorCount: number;
  newCount: number;
  diffCount: number;
  warnings: string[];
}> {
  const columns = loadBundledImportColumns();
  const config = await ppdConfigFromDb(args.db, args.rapide);
  const aoa = parseWorkbookToAoa(args.buffer);
  const lookups = await loadLookupCatalog(args.db);
  const parsed = parsePpdSheet(aoa, columns, lookups, config);
  const existing = await loadDocumentSnapshots(args.db);
  const jalons = await listJalons(args.db);
  const diffs = computeDifferences({
    staged: parsed.rows,
    existing,
    columns,
    lookups,
    jalons,
  });

  const now = new Date().toISOString();
  const errorCount = parsed.rows.filter((r) => r.errors.length).length;
  const newCount = parsed.rows.filter((r) => r.isNew).length;

  const batchId = await args.db.transaction(async () => {
    const inserted = await args.db.run(
      `INSERT INTO import_batch (ImportUser, ImportTime, FileName, Mode, Status, Warning, RowCount, ErrorCount)
       VALUES (?, ?, ?, ?, 'staged', ?, ?, ?)`,
      [args.user, now, args.fileName, parsed.mode, parsed.warnings.join("\n"), parsed.rows.length, errorCount],
    );
    const id = inserted.lastInsertId;
    for (const row of parsed.rows) {
      await args.db.run(
        `INSERT INTO import_raw (BatchId, ImportUser, ImportTime, GroupeLigne, IndiceLigne, ligneEXCEL, erreur, NouveauDocument, payload_json, jalon_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          args.user,
          now,
          row.groupeLigne,
          row.indiceLigne,
          row.ligneExcel,
          row.errors.join("\n") || null,
          row.isNew ? 1 : 0,
          JSON.stringify({ ...row.fields, ...jalonsToRawFields(row.jalons), display: row.displayFields }),
          JSON.stringify(row.jalons),
        ],
      );
      for (const slot of row.jalons) {
        const def = matchJalonDef(slot, jalons);
        if (!def) continue;
        await args.db.run(
          `INSERT INTO import_programmation_jalon (BatchId, IdJalon, EstPrevisionnel, DatePrevisionnelle, Version, Code, Revision, GroupeLigne, IndiceLigne)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            def.id,
            slot.estPrevisionnel ? 1 : 0,
            slot.date,
            slot.valeur,
            def.code,
            row.fields.Revision ?? null,
            row.groupeLigne,
            row.indiceLigne,
          ],
        );
      }
    }
    for (const d of diffs) {
      await args.db.run(
        `INSERT INTO import_compare (BatchId, GroupeLigne, IndiceLigne, titre_fr, fieldName, fieldLabel, oldValue, newValue, isImported, NouveauDocument, "table", oldValue_brut, newValue_brut, oldEstPrevisionnel, newEstPrevisionnel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          d.groupeLigne,
          d.indiceLigne,
          d.titreFr,
          d.fieldName,
          d.fieldLabel,
          d.oldValue,
          d.newValue,
          d.nouveauDocument ? 1 : 0,
          d.table,
          d.oldValueBrut,
          d.newValueBrut,
          d.oldEstPrevisionnel ? 1 : 0,
          d.newEstPrevisionnel ? 1 : 0,
        ],
      );
    }
    return id;
  });

  await args.storage.write(`IMPORT_PPD/${batchId}_${args.fileName}`, args.buffer);
  return {
    batchId,
    rowCount: parsed.rows.length,
    errorCount,
    newCount,
    diffCount: diffs.length,
    warnings: parsed.warnings,
  };
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

export async function applyImportBatch(
  db: SqlDatabase,
  batchId: number,
  user: string,
  options?: { onlyWithoutError?: boolean },
): Promise<{ appliedDocuments: number; appliedJalons: number; skippedErrors: number; alreadyApplied?: boolean }> {
  const batch = await db.get<{ Status: string; AppliedDocuments?: number; AppliedJalons?: number }>(
    "SELECT * FROM import_batch WHERE Id = ?",
    [batchId],
  );
  if (!batch) throw new Error("Lot d'import introuvable");
  if (String(batch.Status) === "applied") {
    return {
      appliedDocuments: Number(batch.AppliedDocuments ?? 0),
      appliedJalons: Number(batch.AppliedJalons ?? 0),
      skippedErrors: 0,
      alreadyApplied: true,
    };
  }

  const raws = await db.all<{
    Id: number;
    GroupeLigne: number;
    IndiceLigne: string;
    erreur: string | null;
    payload_json: string;
    jalon_json: string | null;
    NouveauDocument: number;
  }>("SELECT * FROM import_raw WHERE BatchId = ?", [batchId]);

  const now = new Date().toISOString();
  const skipErrors = options?.onlyWithoutError !== false;
  const defs = await listJalons(db);
  const existingDocs = await db.all<Record<string, unknown>>("SELECT * FROM document");
  const byKey = new Map<string, Record<string, unknown>>();
  for (const d of existingDocs) {
    byKey.set(`${Number(d.GroupeLigne)}::${String(d.IndiceLigne ?? "")}`, d);
  }

  const result = await db.transaction(async () => {
    let appliedDocuments = 0;
    let appliedJalons = 0;
    let skippedErrors = 0;

    for (const raw of raws) {
      if (skipErrors && raw.erreur) {
        skippedErrors++;
        continue;
      }
      const payload = JSON.parse(raw.payload_json) as Record<string, unknown>;
      remapDocumentAliases(payload);
      const key = `${Number(raw.GroupeLigne)}::${String(raw.IndiceLigne ?? "")}`;
      const existing = byKey.get(key);

      const fields: Record<string, string | number | null> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (DOCUMENT_FIELDS.has(k)) fields[k] = sqliteValue(v);
      }
      fields.GroupeLigne = raw.GroupeLigne;
      fields.IndiceLigne = raw.IndiceLigne;
      if (!fields.RefExt) fields.RefExt = sqliteValue(existing?.RefExt) ?? "";
      if (!fields.Revision) fields.Revision = sqliteValue(existing?.Revision) ?? "";
      if (!fields.Livrable) fields.Livrable = sqliteValue(existing?.Livrable) ?? "";
      if (fields.EffMateriel === undefined || fields.EffMateriel === null) {
        fields.EffMateriel = sqliteValue(existing?.EffMateriel) ?? "";
      }

      let docId: number;
      if (!existing) {
        const cols = Object.keys(fields);
        const sql = `INSERT INTO document (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
        const ins = await db.run(
          sql,
          cols.map((c) => fields[c]),
        );
        docId = ins.lastInsertId;
        appliedDocuments++;
        await db.run(
          `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
           VALUES (?, ?, ?, '_nouveau', '', 'import', ?, ?, 1)`,
          [docId, raw.GroupeLigne, raw.IndiceLigne, user, now],
        );
        byKey.set(key, { Id: docId, ...fields });
      } else {
        docId = Number(existing.Id);
        const sets: string[] = [];
        const params: unknown[] = [];
        for (const [k, v] of Object.entries(fields)) {
          if (k === "GroupeLigne" || k === "IndiceLigne") continue;
          if (v === undefined) continue;
          const oldVal = existing[k];
          if (String(oldVal ?? "") === String(v ?? "")) continue;
          sets.push(`${k} = ?`);
          params.push(sqliteValue(v));
          await db.run(
            `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [docId, raw.GroupeLigne, raw.IndiceLigne, k, String(oldVal ?? ""), String(v ?? ""), user, now],
          );
          existing[k] = v;
        }
        if (sets.length) {
          params.push(docId);
          await db.run(`UPDATE document SET ${sets.join(", ")} WHERE Id = ?`, params);
          appliedDocuments++;
        }
      }

      const jalons = raw.jalon_json
        ? (JSON.parse(raw.jalon_json) as Array<{
            index?: number;
            nom: string;
            valeur: string;
            date: string | null;
            estPrevisionnel: boolean;
          }>)
        : [];
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
        await db.run(
          `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, DatePrevisionnelle, Version, Code, Revision)
           VALUES (?, ?, 0, ?, ?, ?, ?, ?)
           ON CONFLICT(IdDocument, IdJalon) DO UPDATE SET
             EstPrevisionnel = excluded.EstPrevisionnel,
             DatePrevisionnelle = excluded.DatePrevisionnelle,
             Version = excluded.Version,
             Code = excluded.Code,
             Revision = excluded.Revision`,
          [
            docId,
            def.id,
            slot.estPrevisionnel ? 1 : 0,
            slot.date,
            slot.valeur,
            def.code,
            fields.Revision ?? null,
          ],
        );
        appliedJalons++;
      }
    }

    await db.run("UPDATE import_compare SET isImported = 1 WHERE BatchId = ?", [batchId]);
    await db.run(
      "UPDATE import_batch SET Status = 'applied', AppliedDocuments = ?, AppliedJalons = ? WHERE Id = ?",
      [appliedDocuments, appliedJalons, batchId],
    );
    return { appliedDocuments, appliedJalons, skippedErrors };
  });

  return result;
}

function sqliteValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return value;
  return String(value);
}

function remapDocumentAliases(payload: Record<string, unknown>): void {
  if (payload.IdPIC !== undefined) payload.IDPic = payload.IdPIC;
  if (payload.IdPICSupport !== undefined) payload.IdPicSupport = payload.IdPICSupport;
  if (payload.IdPerimetre !== undefined) payload.IDPerimetre = payload.IdPerimetre;
  if (payload.estConfidentiel !== undefined) payload.EstConfidentiel = payload.estConfidentiel;
}
