import { writeAoaWorkbook, writeMultiSheetWorkbook } from "@mi20/domain";
import type { SqlDatabase } from "./sql.js";
import { dbStats } from "./seed.js";
import type { FileStorage } from "./storage.js";

export type KpiExportKind = "kpi" | "bilan" | "docts";

function stamp(prefix: string): string {
  return `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

export async function buildKpiWorkbook(db: SqlDatabase): Promise<{ buffer: Buffer; fileName: string }> {
  const stats = await dbStats(db);
  const byFournisseur = await db.all<{ nom: string; c: number }>(
    `SELECT COALESCE(l.nom, '(sans)') as nom, COUNT(*) as c
     FROM document d
     LEFT JOIN lookup_row l ON l.id = d.IdFournisseur
     GROUP BY COALESCE(l.nom, '(sans)')
     ORDER BY c DESC`,
  );
  const byJalon = await db.all<{ Code: string; c: number }>(
    `SELECT j.Code, COUNT(*) as c
     FROM programmation_jalon pj
     JOIN jalon j ON j.Id = pj.IdJalon
     GROUP BY j.Code
     ORDER BY j.Id`,
  );
  const buffer = writeMultiSheetWorkbook([
    {
      name: "KPI",
      aoa: [
        ["Indicateur", "Valeur"],
        ["Documents", stats.documents],
        ["Jalons programmés", stats.jalonsProgrammes],
        ["Bordereaux", stats.bordereaux],
        ["Envois", stats.envois],
        ["Révisions", stats.revisions],
        ["Fiches d'avis", stats.retoursRatp],
        ["Lignes d'audit (doc_histo)", stats.histo],
        ["Généré le", new Date().toISOString()],
      ],
    },
    {
      name: "Par fournisseur",
      aoa: [["Fournisseur", "Documents"], ...byFournisseur.map((r) => [r.nom, r.c])],
    },
    {
      name: "Par jalon",
      aoa: [["Jalon", "Programmations"], ...byJalon.map((r) => [r.Code, r.c])],
    },
  ]);
  return { buffer, fileName: stamp("KPI_MI20") };
}

export async function buildBilanEnvoisWorkbook(db: SqlDatabase): Promise<{ buffer: Buffer; fileName: string }> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT b.NomComplet as Bordereau, d.GroupeLigne, d.IndiceLigne, d.RefExt, d.Titre,
            e.Revision, e.DateReceptionRATP, e.ReponseFicheAvis, e.FichierFicheAvis_Envoye,
            e.NumLotRATP, e.CommentairesRATP, e.NomUtilisateur
     FROM envoi e
     JOIN document d ON d.Id = e.IdDocument
     JOIN bordereau b ON b.Id = e.IdBordereau
     ORDER BY b.NomComplet, d.GroupeLigne, d.IndiceLigne`,
  );
  const header = [
    "Bordereau",
    "GroupeLigne",
    "IndiceLigne",
    "RefExt",
    "Titre",
    "Revision",
    "DateReceptionRATP",
    "ReponseFicheAvis",
    "FichierFicheAvis_Envoye",
    "NumLotRATP",
    "CommentairesRATP",
    "NomUtilisateur",
  ];
  const aoa: unknown[][] = [
    header,
    ...rows.map((r) => header.map((h) => r[h] ?? "")),
  ];
  return { buffer: writeAoaWorkbook(aoa, "BilanEnvois"), fileName: stamp("BILAN_ENVOIS_MI20") };
}

export async function buildDoctsAutorisationWorkbook(db: SqlDatabase): Promise<{ buffer: Buffer; fileName: string }> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT d.GroupeLigne, d.IndiceLigne, d.RefExt, d.Titre, d.Revision, d.Livrable,
            (SELECT nom FROM lookup_row WHERE id = d.IdFournisseur) as Fournisseur,
            (SELECT nom FROM lookup_row WHERE id = d.IdPreuveAutorisation) as PreuveAutorisation
     FROM document d
     WHERE d.Homologuant = 1
     ORDER BY d.GroupeLigne, d.IndiceLigne`,
  );
  const header = [
    "GroupeLigne",
    "IndiceLigne",
    "RefExt",
    "Titre",
    "Revision",
    "Livrable",
    "Fournisseur",
    "PreuveAutorisation",
  ];
  const aoa: unknown[][] = [header, ...rows.map((r) => header.map((h) => r[h] ?? ""))];
  return { buffer: writeAoaWorkbook(aoa, "DoctsAutorisation"), fileName: stamp("DOCTS_AUTORISATION_MI20") };
}

export async function buildKpiExport(
  db: SqlDatabase,
  kind: KpiExportKind,
): Promise<{ buffer: Buffer; fileName: string }> {
  if (kind === "bilan") return buildBilanEnvoisWorkbook(db);
  if (kind === "docts") return buildDoctsAutorisationWorkbook(db);
  return buildKpiWorkbook(db);
}

export async function storeKpiExport(
  storage: FileStorage,
  kind: KpiExportKind,
  fileName: string,
  buffer: Buffer,
): Promise<void> {
  const folder = kind === "bilan" ? "EXPORT_BILAN_ENVOIS" : kind === "docts" ? "EXPORT_KPI" : "EXPORT_KPI";
  await storage.write(`${folder}/${fileName}`, buffer);
}
