import { parseFaSheet, parseWorkbookToAoa, matchJalonDef, formatLigne } from "@mi20/domain";
import type { FileStorage } from "./storage.js";
import type { SqlDatabase } from "./sql.js";
import { listJalons } from "./import-service.js";

export async function importFaBuffer(args: {
  db: SqlDatabase;
  storage: FileStorage;
  buffer: Buffer;
  fileName: string;
  user: string;
}): Promise<{
  batchId: number;
  rowCount: number;
  errorCount: number;
  matchedCount: number;
  warnings: string[];
}> {
  const aoa = parseWorkbookToAoa(args.buffer, "FA");
  const parsed = parseFaSheet(aoa);
  const now = new Date().toISOString();
  const docs = await args.db.all<{ Id: number; GroupeLigne: number; IndiceLigne: string; Titre: string }>(
    "SELECT Id, GroupeLigne, IndiceLigne, Titre FROM document",
  );
  const byKey = new Map(docs.map((d) => [`${Number(d.GroupeLigne)}::${String(d.IndiceLigne ?? "")}`, d]));

  let errorCount = 0;
  let matchedCount = 0;
  for (const row of parsed.rows) {
    if (row.groupeLigne == null) {
      errorCount++;
      continue;
    }
    const doc = byKey.get(`${row.groupeLigne}::${row.indiceLigne}`);
    if (!doc) {
      row.errors.push(
        `Document ${formatLigne(row.groupeLigne, row.indiceLigne)} introuvable — la fiche avis n'a pas de livrable cible.`,
      );
      errorCount++;
    } else {
      matchedCount++;
    }
  }

  const batchId = await args.db.transaction(async () => {
    const inserted = await args.db.run(
      `INSERT INTO import_batch (ImportUser, ImportTime, FileName, Mode, Status, Warning, RowCount, ErrorCount)
       VALUES (?, ?, ?, 'fa', 'staged', ?, ?, ?)`,
      [args.user, now, args.fileName, parsed.warnings.join("\n"), parsed.rows.length, errorCount],
    );
    const id = inserted.lastInsertId;
    for (const row of parsed.rows) {
      const doc =
        row.groupeLigne != null ? byKey.get(`${row.groupeLigne}::${row.indiceLigne}`) : undefined;
      await args.db.run(
        `INSERT INTO import_fa_raw (
          BatchId, ligneEXCEL, GroupeLigne, IndiceLigne, Revision, Jalon, Version, EstPrevisionnel,
          DatePrevisionnelle, ReponseFicheAvis, FichierFicheAvis, DateReceptionRATP, DatePrevReceptionFA,
          NumLotRATP, CommentairesRATP, CommentairesSup, RefuseAuChargement, NomUtilisateur, erreur,
          payload_json, IdDocument
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          row.ligneExcel,
          row.groupeLigne,
          row.indiceLigne,
          row.revision,
          row.jalon,
          row.version,
          row.estPrevisionnel ? 1 : 0,
          row.datePrevisionnelle,
          row.reponseFicheAvis,
          row.fichierFicheAvis,
          row.dateReceptionRATP,
          row.datePrevReceptionFA,
          row.numLotRATP,
          row.commentairesRATP,
          row.commentairesSup,
          row.refuseAuChargement,
          row.nomUtilisateur || args.user,
          row.errors.join("\n") || null,
          JSON.stringify(row),
          doc?.Id ?? null,
        ],
      );
    }
    return id;
  });

  await args.storage.write(`IMPORT_FA/${batchId}_${args.fileName}`, args.buffer);
  return {
    batchId,
    rowCount: parsed.rows.length,
    errorCount,
    matchedCount,
    warnings: parsed.warnings,
  };
}

export async function applyFaBatch(
  db: SqlDatabase,
  batchId: number,
  user: string,
): Promise<{
  appliedFiches: number;
  updatedEnvois: number;
  updatedRevisions: number;
  skippedErrors: number;
  alreadyApplied?: boolean;
}> {
  const batch = await db.get<{ Status: string; Mode: string; AppliedFiches?: number }>(
    "SELECT * FROM import_batch WHERE Id = ?",
    [batchId],
  );
  if (!batch) throw new Error("Lot d'import introuvable");
  if (String(batch.Status) === "applied") {
    return {
      appliedFiches: Number(batch.AppliedFiches ?? 0),
      updatedEnvois: 0,
      updatedRevisions: 0,
      skippedErrors: 0,
      alreadyApplied: true,
    };
  }

  const raws = await db.all<Record<string, unknown>>("SELECT * FROM import_fa_raw WHERE BatchId = ?", [batchId]);
  const jalons = await listJalons(db);
  const now = new Date().toISOString();

  return db.transaction(async () => {
    let appliedFiches = 0;
    let updatedEnvois = 0;
    let updatedRevisions = 0;
    let skippedErrors = 0;

    for (const raw of raws) {
      if (raw.erreur) {
        skippedErrors++;
        continue;
      }
      const groupe = Number(raw.GroupeLigne);
      const indice = String(raw.IndiceLigne ?? "");
      let docId = raw.IdDocument != null ? Number(raw.IdDocument) : 0;
      if (!docId) {
        const doc = await db.get<{ Id: number }>(
          "SELECT Id FROM document WHERE GroupeLigne = ? AND IndiceLigne = ?",
          [groupe, indice],
        );
        if (!doc) {
          skippedErrors++;
          continue;
        }
        docId = doc.Id;
      }

      const jalonCode = String(raw.Jalon ?? "").trim();
      let pjId: number | null = null;
      if (jalonCode) {
        const def = matchJalonDef(
          { index: 0, nom: jalonCode, valeur: String(raw.Version ?? ""), date: null, estPrevisionnel: false },
          jalons,
        );
        if (def) {
          const existingPj = await db.get<{ Id: number }>(
            "SELECT Id FROM programmation_jalon WHERE IdDocument = ? AND IdJalon = ?",
            [docId, def.id],
          );
          if (existingPj) {
            pjId = existingPj.Id;
            if (raw.Version || raw.DatePrevisionnelle || raw.Revision) {
              await db.run(
                `UPDATE programmation_jalon SET Version = COALESCE(?, Version), DatePrevisionnelle = COALESCE(?, DatePrevisionnelle),
                 EstPrevisionnel = ?, Revision = COALESCE(?, Revision) WHERE Id = ?`,
                [
                  raw.Version || null,
                  raw.DatePrevisionnelle || null,
                  Number(raw.EstPrevisionnel) ? 1 : 0,
                  raw.Revision || null,
                  pjId,
                ],
              );
            }
          } else {
            const ins = await db.run(
              `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, DatePrevisionnelle, Version, Code, Revision)
               VALUES (?, ?, 0, ?, ?, ?, ?, ?)`,
              [
                docId,
                def.id,
                Number(raw.EstPrevisionnel) ? 1 : 0,
                raw.DatePrevisionnelle || null,
                raw.Version || null,
                def.code,
                raw.Revision || null,
              ],
            );
            pjId = ins.lastInsertId;
          }
        }
      }
      if (pjId == null) {
        const anyPj = await db.get<{ Id: number }>(
          "SELECT Id FROM programmation_jalon WHERE IdDocument = ? ORDER BY Id LIMIT 1",
          [docId],
        );
        pjId = anyPj?.Id ?? null;
      }

      const revisionLabel = String(raw.Revision ?? "").trim() || "A";
      let revisionId: number | null = null;
      if (pjId != null) {
        const existingRev = await db.get<{ Id: number }>(
          "SELECT Id FROM revision WHERE IdProgrammationJalon = ? AND Revision = ?",
          [pjId, revisionLabel],
        );
        if (existingRev) {
          revisionId = existingRev.Id;
          await db.run(
            `UPDATE revision SET FichierFicheAvis_AEnvoyer = COALESCE(?, FichierFicheAvis_AEnvoyer),
             IdDocument = ?, NomUtilisateur = COALESCE(?, NomUtilisateur) WHERE Id = ?`,
            [raw.FichierFicheAvis || null, docId, raw.NomUtilisateur || user, revisionId],
          );
          updatedRevisions++;
        } else {
          const ins = await db.run(
            `INSERT INTO revision (Revision, IdProgrammationJalon, NomUtilisateur, EstActive, FichierFicheAvis_AEnvoyer, IdDocument, CreatedAt)
             VALUES (?, ?, ?, 1, ?, ?, ?)`,
            [revisionLabel, pjId, raw.NomUtilisateur || user, raw.FichierFicheAvis || null, docId, now],
          );
          revisionId = ins.lastInsertId;
          updatedRevisions++;
        }
        await db.run("UPDATE document SET Revision = ? WHERE Id = ?", [revisionLabel, docId]);
      } else {
        const ins = await db.run(
          `INSERT INTO revision (Revision, IdProgrammationJalon, NomUtilisateur, EstActive, FichierFicheAvis_AEnvoyer, IdDocument, CreatedAt)
           VALUES (?, 0, ?, 1, ?, ?, ?)`,
          [revisionLabel, raw.NomUtilisateur || user, raw.FichierFicheAvis || null, docId, now],
        );
        revisionId = ins.lastInsertId;
        updatedRevisions++;
      }

      const envoi = await db.get<{ Id: number }>(
        "SELECT Id FROM envoi WHERE IdDocument = ? ORDER BY Id DESC LIMIT 1",
        [docId],
      );
      let envoiId: number | null = envoi?.Id ?? null;
      if (envoiId != null) {
        await db.run(
          `UPDATE envoi SET
             IdRevision = COALESCE(?, IdRevision),
             Revision = COALESCE(?, Revision),
             DateReceptionRATP = COALESCE(?, DateReceptionRATP),
             DatePrevReceptionFA = COALESCE(?, DatePrevReceptionFA),
             FichierFicheAvis_Envoye = COALESCE(?, FichierFicheAvis_Envoye),
             ReponseFicheAvis = COALESCE(?, ReponseFicheAvis),
             NumLotRATP = COALESCE(?, NumLotRATP),
             CommentairesRATP = COALESCE(?, CommentairesRATP),
             CommentairesSupSurRetourRATP = COALESCE(?, CommentairesSupSurRetourRATP),
             RefuseAuChargement = COALESCE(?, RefuseAuChargement),
             NomUtilisateur = COALESCE(?, NomUtilisateur)
           WHERE Id = ?`,
          [
            revisionId,
            revisionLabel,
            raw.DateReceptionRATP || null,
            raw.DatePrevReceptionFA || null,
            raw.FichierFicheAvis || null,
            raw.ReponseFicheAvis || null,
            raw.NumLotRATP || null,
            raw.CommentairesRATP || null,
            raw.CommentairesSup || null,
            raw.RefuseAuChargement || null,
            raw.NomUtilisateur || user,
            envoiId,
          ],
        );
        updatedEnvois++;
      }

      const statut = String(raw.ReponseFicheAvis || raw.FichierFicheAvis || "FA");
      await db.run(
        `INSERT INTO fiche_avis (
           IdEnvoi, IdDocument, IdRevision, NomFichier, Statut, DateSaisie, Commentaire,
           ReponseFicheAvis, DateReceptionRATP, NumLotRATP, CommentairesRATP, CommentairesSup,
           RefuseAuChargement, NomUtilisateur, GroupeLigne, IndiceLigne, Revision, Jalon, Version, FichierFicheAvis
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          envoiId,
          docId,
          revisionId,
          raw.FichierFicheAvis || null,
          statut,
          now,
          raw.CommentairesRATP || null,
          raw.ReponseFicheAvis || null,
          raw.DateReceptionRATP || null,
          raw.NumLotRATP || null,
          raw.CommentairesRATP || null,
          raw.CommentairesSup || null,
          raw.RefuseAuChargement || null,
          raw.NomUtilisateur || user,
          groupe,
          indice,
          revisionLabel,
          raw.Jalon || null,
          raw.Version || null,
          raw.FichierFicheAvis || null,
        ],
      );
      appliedFiches++;
      await db.run(
        `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
         VALUES (?, ?, ?, 'fiche_avis', '', ?, ?, ?, 1)`,
        [docId, groupe, indice, statut, user, now],
      );
    }

    await db.run("UPDATE import_batch SET Status = 'applied', AppliedFiches = ? WHERE Id = ?", [
      appliedFiches,
      batchId,
    ]);
    return { appliedFiches, updatedEnvois, updatedRevisions, skippedErrors };
  });
}

export async function listFichesAvis(db: SqlDatabase) {
  return db.all(
    `SELECT fa.*, d.Titre
     FROM fiche_avis fa
     LEFT JOIN document d ON d.Id = fa.IdDocument
     ORDER BY fa.Id DESC
     LIMIT 200`,
  );
}

export async function createFicheAvis(
  db: SqlDatabase,
  input: {
    idDocument?: number;
    avis?: string;
    commentaire?: string;
    fichier?: string;
    user: string;
  },
) {
  const doc = input.idDocument
    ? await db.get<Record<string, unknown>>("SELECT * FROM document WHERE Id = ?", [input.idDocument])
    : undefined;
  if (!doc) throw new Error("Document obligatoire pour saisir un retour RATP");
  const now = new Date().toISOString();
  const avis = (input.avis ?? "FA").trim() || "FA";
  const envoi = await db.get<{ Id: number }>(
    "SELECT Id FROM envoi WHERE IdDocument = ? ORDER BY Id DESC LIMIT 1",
    [Number(doc.Id)],
  );
  if (envoi) {
    await db.run(
      `UPDATE envoi SET ReponseFicheAvis = ?, CommentairesRATP = COALESCE(?, CommentairesRATP),
       FichierFicheAvis_Envoye = COALESCE(?, FichierFicheAvis_Envoye), NomUtilisateur = ?
       WHERE Id = ?`,
      [avis, input.commentaire ?? null, input.fichier ?? null, input.user, envoi.Id],
    );
  }
  const pj = await db.get<{ Id: number }>(
    "SELECT Id FROM programmation_jalon WHERE IdDocument = ? ORDER BY Id LIMIT 1",
    [Number(doc.Id)],
  );
  let revisionId: number | null = null;
  if (pj) {
    const rev = await db.get<{ Id: number }>(
      "SELECT Id FROM revision WHERE IdProgrammationJalon = ? ORDER BY Id DESC LIMIT 1",
      [pj.Id],
    );
    if (rev) {
      revisionId = rev.Id;
      await db.run(
        `UPDATE revision SET FichierFicheAvis_AEnvoyer = COALESCE(?, FichierFicheAvis_AEnvoyer) WHERE Id = ?`,
        [input.fichier ?? null, revisionId],
      );
    } else {
      const createdRev = await db.run(
        `INSERT INTO revision (Revision, IdProgrammationJalon, NomUtilisateur, EstActive, FichierFicheAvis_AEnvoyer, IdDocument, CreatedAt)
         VALUES (?, ?, ?, 1, ?, ?, ?)`,
        [String(doc.Revision ?? "A"), pj.Id, input.user, input.fichier ?? null, Number(doc.Id), now],
      );
      revisionId = createdRev.lastInsertId;
    }
  }
  const created = await db.run(
    `INSERT INTO fiche_avis (
       IdEnvoi, IdDocument, IdRevision, NomFichier, Statut, DateSaisie, Commentaire,
       ReponseFicheAvis, NomUtilisateur, GroupeLigne, IndiceLigne, Revision, FichierFicheAvis
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      envoi?.Id ?? null,
      Number(doc.Id),
      revisionId,
      input.fichier ?? null,
      avis,
      now,
      input.commentaire ?? null,
      avis,
      input.user,
      doc.GroupeLigne,
      doc.IndiceLigne,
      doc.Revision,
      input.fichier ?? null,
    ],
  );
  await db.run(
    `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
     VALUES (?, ?, ?, 'fiche_avis', '', ?, ?, ?, 0)`,
    [Number(doc.Id), doc.GroupeLigne, doc.IndiceLigne, avis, input.user, now],
  );
  return db.get("SELECT * FROM fiche_avis WHERE Id = ?", [created.lastInsertId]);
}
