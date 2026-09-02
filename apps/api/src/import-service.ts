import type Database from "better-sqlite3";
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

export function ppdConfigFromDb(db: Database.Database, rapide: boolean): PpdConfig {
  const get = (k: string, d: string) => {
    const row = db.prepare("SELECT value FROM app_config WHERE key = ?").get(k) as { value: string } | undefined;
    return row?.value ?? d;
  };
  return {
    ...DEFAULT_PPD_CONFIG,
    firstColumnTitle: get("titrePremiereColonneXLS_PPD", DEFAULT_PPD_CONFIG.firstColumnTitle),
    firstColumnTitleRapide: get(
      "titrePremiereColonneXLS_PPD_rapide",
      DEFAULT_PPD_CONFIG.firstColumnTitleRapide,
    ),
    jalonCount: Number(get("nbJalonsPPD", "23")),
    ratpMaskedColumns: get("exportRatpMask", "C,AA,AB,AC")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rapide,
  };
}

export function listJalons(db: Database.Database) {
  return db.prepare("SELECT Id as id, Nom as nom, Code as code FROM jalon ORDER BY Id").all() as Array<{
    id: number;
    nom: string;
    code: string;
  }>;
}

export function loadDocumentSnapshots(db: Database.Database): DocumentSnapshot[] {
  const docs = db.prepare("SELECT * FROM document").all() as Array<Record<string, unknown>>;
  const jalons = db
    .prepare(
      `SELECT pj.*, j.Code as jalonCode, j.Nom as jalonNom
       FROM programmation_jalon pj JOIN jalon j ON j.Id = pj.IdJalon`,
    )
    .all() as Array<Record<string, unknown>>;
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
  db: Database.Database;
  storage: FileStorage;
  buffer: Buffer;
  fileName: string;
  user: string;
  rapide: boolean;
}): Promise<{ batchId: number; rowCount: number; errorCount: number; newCount: number; diffCount: number; warnings: string[] }> {
  const columns = loadBundledImportColumns();
  const config = ppdConfigFromDb(args.db, args.rapide);
  const aoa = parseWorkbookToAoa(args.buffer);
  const lookups = loadLookupCatalog(args.db);
  const parsed = parsePpdSheet(aoa, columns, lookups, config);
  const existing = loadDocumentSnapshots(args.db);
  const jalons = listJalons(args.db);
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

  const insertBatch = args.db.prepare(
    `INSERT INTO import_batch (ImportUser, ImportTime, FileName, Mode, Status, Warning, RowCount, ErrorCount)
     VALUES (?, ?, ?, ?, 'staged', ?, ?, ?)`,
  );
  const batchId = Number(
    insertBatch.run(
      args.user,
      now,
      args.fileName,
      parsed.mode,
      parsed.warnings.join("\n"),
      parsed.rows.length,
      errorCount,
    ).lastInsertRowid,
  );

  const insertRaw = args.db.prepare(
    `INSERT INTO import_raw (BatchId, ImportUser, ImportTime, GroupeLigne, IndiceLigne, ligneEXCEL, erreur, NouveauDocument, payload_json, jalon_json)
     VALUES (@BatchId, @ImportUser, @ImportTime, @GroupeLigne, @IndiceLigne, @ligneEXCEL, @erreur, @NouveauDocument, @payload_json, @jalon_json)`,
  );
  const insertCmp = args.db.prepare(
    `INSERT INTO import_compare (BatchId, GroupeLigne, IndiceLigne, titre_fr, fieldName, fieldLabel, oldValue, newValue, isImported, NouveauDocument, "table", oldValue_brut, newValue_brut, oldEstPrevisionnel, newEstPrevisionnel)
     VALUES (@BatchId, @GroupeLigne, @IndiceLigne, @titre_fr, @fieldName, @fieldLabel, @oldValue, @newValue, 0, @NouveauDocument, @table, @oldValue_brut, @newValue_brut, @oldEstPrevisionnel, @newEstPrevisionnel)`,
  );
  const insertJalon = args.db.prepare(
    `INSERT INTO import_programmation_jalon (BatchId, IdJalon, EstPrevisionnel, DatePrevisionnelle, Version, Code, Revision, GroupeLigne, IndiceLigne)
     VALUES (@BatchId, @IdJalon, @EstPrevisionnel, @DatePrevisionnelle, @Version, @Code, @Revision, @GroupeLigne, @IndiceLigne)`,
  );

  const tx = args.db.transaction(() => {
    for (const row of parsed.rows) {
      insertRaw.run({
        BatchId: batchId,
        ImportUser: args.user,
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
        const def = matchJalonDef(slot, jalons);
        if (!def) continue;
        insertJalon.run({
          BatchId: batchId,
          IdJalon: def.id,
          EstPrevisionnel: slot.estPrevisionnel ? 1 : 0,
          DatePrevisionnelle: slot.date,
          Version: slot.valeur,
          Code: def.code,
          Revision: row.fields.Revision ?? null,
          GroupeLigne: row.groupeLigne,
          IndiceLigne: row.indiceLigne,
        });
      }
    }
    for (const d of diffs) {
      insertCmp.run({
        BatchId: batchId,
        GroupeLigne: d.groupeLigne,
        IndiceLigne: d.indiceLigne,
        titre_fr: d.titreFr,
        fieldName: d.fieldName,
        fieldLabel: d.fieldLabel,
        oldValue: d.oldValue,
        newValue: d.newValue,
        NouveauDocument: d.nouveauDocument ? 1 : 0,
        table: d.table,
        oldValue_brut: d.oldValueBrut,
        newValue_brut: d.newValueBrut,
        oldEstPrevisionnel: d.oldEstPrevisionnel ? 1 : 0,
        newEstPrevisionnel: d.newEstPrevisionnel ? 1 : 0,
      });
    }
  });
  tx();

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

export function applyImportBatch(
  db: Database.Database,
  batchId: number,
  user: string,
  options?: { onlyWithoutError?: boolean },
): { appliedDocuments: number; appliedJalons: number } {
  const batch = db.prepare("SELECT * FROM import_batch WHERE Id = ?").get(batchId) as
    | { Status: string }
    | undefined;
  if (!batch) throw new Error("Lot d'import introuvable");

  const raws = db
    .prepare("SELECT * FROM import_raw WHERE BatchId = ?")
    .all(batchId) as Array<{
    Id: number;
    GroupeLigne: number;
    IndiceLigne: string;
    erreur: string | null;
    payload_json: string;
    jalon_json: string | null;
    NouveauDocument: number;
  }>;

  const now = new Date().toISOString();
  let appliedDocuments = 0;
  let appliedJalons = 0;

  const tx = db.transaction(() => {
    for (const raw of raws) {
      if (options?.onlyWithoutError !== false && raw.erreur) continue;
      const payload = JSON.parse(raw.payload_json) as Record<string, unknown>;
      remapDocumentAliases(payload);
      const existing = db
        .prepare("SELECT * FROM document WHERE GroupeLigne = ? AND IndiceLigne = ?")
        .get(raw.GroupeLigne, raw.IndiceLigne) as Record<string, unknown> | undefined;

      const fields: Record<string, string | number | bigint | Buffer | null> = {};
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
        const sql = `INSERT INTO document (${cols.join(",")}) VALUES (${cols.map((c) => `@${c}`).join(",")})`;
        docId = Number(db.prepare(sql).run(fields).lastInsertRowid);
        appliedDocuments++;
        db.prepare(
          `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
           VALUES (?, ?, ?, '_nouveau', '', 'import', ?, ?, 1)`,
        ).run(docId, raw.GroupeLigne, raw.IndiceLigne, user, now);
      } else {
        docId = Number(existing.Id);
        const sets: string[] = [];
        const params: Record<string, string | number | bigint | Buffer | null> = { Id: docId };
        for (const [k, v] of Object.entries(fields)) {
          if (k === "GroupeLigne" || k === "IndiceLigne") continue;
          if (v === undefined) continue;
          const oldVal = existing[k];
          if (String(oldVal ?? "") === String(v ?? "")) continue;
          sets.push(`${k} = @${k}`);
          params[k] = sqliteValue(v);
          db.prepare(
            `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          ).run(docId, raw.GroupeLigne, raw.IndiceLigne, k, String(oldVal ?? ""), String(v ?? ""), user, now);
        }
        if (sets.length) {
          db.prepare(`UPDATE document SET ${sets.join(", ")} WHERE Id = @Id`).run(params);
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
      const defs = listJalons(db);
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
        const upsert = db.prepare(
          `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, DatePrevisionnelle, Version, Code, Revision)
           VALUES (@IdDocument, @IdJalon, 0, @EstPrevisionnel, @DatePrevisionnelle, @Version, @Code, @Revision)
           ON CONFLICT(IdDocument, IdJalon) DO UPDATE SET
             EstPrevisionnel = excluded.EstPrevisionnel,
             DatePrevisionnelle = excluded.DatePrevisionnelle,
             Version = excluded.Version,
             Code = excluded.Code,
             Revision = excluded.Revision`,
        );
        upsert.run({
          IdDocument: docId,
          IdJalon: def.id,
          EstPrevisionnel: slot.estPrevisionnel ? 1 : 0,
          DatePrevisionnelle: slot.date,
          Version: slot.valeur,
          Code: def.code,
          Revision: fields.Revision ?? null,
        });
        appliedJalons++;
      }
    }

    db.prepare("UPDATE import_compare SET isImported = 1 WHERE BatchId = ?").run(batchId);
    db.prepare("UPDATE import_batch SET Status = 'applied' WHERE Id = ?").run(batchId);
  });
  tx();

  return { appliedDocuments, appliedJalons };
}

function sqliteValue(value: unknown): string | number | bigint | Buffer | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "bigint") return value;
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value;
  return String(value);
}

function remapDocumentAliases(payload: Record<string, unknown>): void {
  if (payload.IdPIC !== undefined) payload.IDPic = payload.IdPIC;
  if (payload.IdPICSupport !== undefined) payload.IdPicSupport = payload.IdPICSupport;
  if (payload.IdPerimetre !== undefined) payload.IDPerimetre = payload.IdPerimetre;
  if (payload.estConfidentiel !== undefined) payload.EstConfidentiel = payload.estConfidentiel;
}
