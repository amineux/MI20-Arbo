import { cellToText, parseLigne } from "./ligne.js";
import { normalizeHeader } from "./columns.js";
import { parseOuiNon } from "./oui-non.js";
import { cellToDateIso } from "./jalon.js";

/** Access config.ini [PPD] titrePremiereColonneXLS_RetoursRATP */
export const FA_FIRST_COLUMN_TITLES = ["NumLivrable", "Num Livrable", "Num Liv.", "Nr Livrable", "N° livrable"];

export interface StagedFicheAvis {
  ligneExcel: number;
  groupeLigne: number | null;
  indiceLigne: string;
  revision: string;
  jalon: string;
  version: string;
  estPrevisionnel: boolean;
  datePrevisionnelle: string | null;
  reponseFicheAvis: string;
  fichierFicheAvis: string;
  dateReceptionRATP: string | null;
  datePrevReceptionFA: string | null;
  numLotRATP: string;
  commentairesRATP: string;
  commentairesSup: string;
  refuseAuChargement: string;
  nomUtilisateur: string;
  errors: string[];
}

export interface ParseFaResult {
  headerRowIndex: number;
  headers: string[];
  rows: StagedFicheAvis[];
  warnings: string[];
}

const HEADER_ALIASES: Record<string, keyof Pick<
  StagedFicheAvis,
  | "revision"
  | "jalon"
  | "version"
  | "estPrevisionnel"
  | "datePrevisionnelle"
  | "reponseFicheAvis"
  | "fichierFicheAvis"
  | "dateReceptionRATP"
  | "datePrevReceptionFA"
  | "numLotRATP"
  | "commentairesRATP"
  | "commentairesSup"
  | "refuseAuChargement"
  | "nomUtilisateur"
>> = {
  revision: "revision",
  indice: "revision",
  "indice de revision": "revision",
  jalon: "jalon",
  version: "version",
  estprevisionnel: "estPrevisionnel",
  "est previsionnel": "estPrevisionnel",
  dateprevisionnelle: "datePrevisionnelle",
  "date previsionnelle": "datePrevisionnelle",
  reponseficheavis: "reponseFicheAvis",
  "reponse fiche avis": "reponseFicheAvis",
  "reponse fa": "reponseFicheAvis",
  avis: "reponseFicheAvis",
  "statut ratp": "reponseFicheAvis",
  fichierficheavis: "fichierFicheAvis",
  fichierficheavis_envoye: "fichierFicheAvis",
  "fichier fiche avis": "fichierFicheAvis",
  "fichier fa": "fichierFicheAvis",
  datereceptionratp: "dateReceptionRATP",
  "date reception ratp": "dateReceptionRATP",
  dateprevreceptionfa: "datePrevReceptionFA",
  "date prev reception fa": "datePrevReceptionFA",
  numlotratp: "numLotRATP",
  "num lot ratp": "numLotRATP",
  commentairesratp: "commentairesRATP",
  "commentaires ratp": "commentairesRATP",
  commentaire: "commentairesRATP",
  commentairestratsup: "commentairesSup",
  commentairessupsurretourratp: "commentairesSup",
  "commentaires sup": "commentairesSup",
  refuseauchargement: "refuseAuChargement",
  "refuse au chargement": "refuseAuChargement",
  nomutilisateur: "nomUtilisateur",
  "nom utilisateur": "nomUtilisateur",
};

export function detectFaHeaderRow(sheet: unknown[][]): number | null {
  const keys = new Set(FA_FIRST_COLUMN_TITLES.map((t) => normalizeHeader(t)));
  const limit = Math.min(sheet.length, 100);
  for (let i = 0; i < limit; i++) {
    const row = sheet[i] ?? [];
    for (const cell of row) {
      if (keys.has(normalizeHeader(cellToText(cell)))) return i;
    }
  }
  return null;
}

export function parseFaSheet(sheet: unknown[][]): ParseFaResult {
  const warnings: string[] = [];
  const headerRowIndex = detectFaHeaderRow(sheet);
  if (headerRowIndex === null) {
    throw new Error(
      `En-tête fiches d'avis introuvable (attendu « NumLivrable » dans les 100 premières lignes — ImportRetoursRATP).`,
    );
  }
  const headerRow = sheet[headerRowIndex] ?? [];
  const headers = headerRow.map((c) => cellToText(c));
  const col = indexFaColumns(headers);
  if (col.ligne === undefined) {
    throw new Error("Colonne NumLivrable introuvable.");
  }

  const rows: StagedFicheAvis[] = [];
  for (let r = headerRowIndex + 1; r < sheet.length; r++) {
    const dataRow = sheet[r] ?? [];
    if (dataRow.every((c) => cellToText(c) === "")) continue;
    const staged: StagedFicheAvis = {
      ligneExcel: r + 1,
      groupeLigne: null,
      indiceLigne: "",
      revision: "",
      jalon: "",
      version: "",
      estPrevisionnel: false,
      datePrevisionnelle: null,
      reponseFicheAvis: "",
      fichierFicheAvis: "",
      dateReceptionRATP: null,
      datePrevReceptionFA: null,
      numLotRATP: "",
      commentairesRATP: "",
      commentairesSup: "",
      refuseAuChargement: "",
      nomUtilisateur: "",
      errors: [],
    };
    const ligneRaw = dataRow[col.ligne];
    if (cellToText(ligneRaw) === "") continue;
    const parsed = parseLigne(ligneRaw);
    if (!parsed) {
      staged.errors.push(
        `Le champ NumLivrable « ${cellToText(ligneRaw)} » (ligne Excel ${staged.ligneExcel}) n'est pas une LIGNE valide (ex. 36 / 9351.3).`,
      );
    } else {
      staged.groupeLigne = parsed.groupeLigne;
      staged.indiceLigne = parsed.indiceLigne;
    }
    assignText(staged, "revision", dataRow, col.revision);
    assignText(staged, "jalon", dataRow, col.jalon);
    assignText(staged, "version", dataRow, col.version);
    if (col.estPrevisionnel !== undefined) {
      staged.estPrevisionnel = Boolean(parseOuiNon(dataRow[col.estPrevisionnel]));
    }
    if (col.datePrevisionnelle !== undefined) {
      staged.datePrevisionnelle =
        cellToDateIso(dataRow[col.datePrevisionnelle]) ??
        (cellToText(dataRow[col.datePrevisionnelle]) || null);
    }
    assignText(staged, "reponseFicheAvis", dataRow, col.reponseFicheAvis);
    assignText(staged, "fichierFicheAvis", dataRow, col.fichierFicheAvis);
    if (col.dateReceptionRATP !== undefined) {
      staged.dateReceptionRATP =
        cellToDateIso(dataRow[col.dateReceptionRATP]) ??
        (cellToText(dataRow[col.dateReceptionRATP]) || null);
    }
    if (col.datePrevReceptionFA !== undefined) {
      staged.datePrevReceptionFA =
        cellToDateIso(dataRow[col.datePrevReceptionFA]) ??
        (cellToText(dataRow[col.datePrevReceptionFA]) || null);
    }
    assignText(staged, "numLotRATP", dataRow, col.numLotRATP);
    assignText(staged, "commentairesRATP", dataRow, col.commentairesRATP);
    assignText(staged, "commentairesSup", dataRow, col.commentairesSup);
    assignText(staged, "refuseAuChargement", dataRow, col.refuseAuChargement);
    assignText(staged, "nomUtilisateur", dataRow, col.nomUtilisateur);
    rows.push(staged);
  }

  if (!rows.length) warnings.push("Aucune ligne de fiche avis dans le classeur.");
  return { headerRowIndex, headers, rows, warnings };
}

function assignText(
  staged: StagedFicheAvis,
  field: "revision" | "jalon" | "version" | "reponseFicheAvis" | "fichierFicheAvis" | "numLotRATP" | "commentairesRATP" | "commentairesSup" | "refuseAuChargement" | "nomUtilisateur",
  dataRow: unknown[],
  idx: number | undefined,
): void {
  if (idx === undefined) return;
  staged[field] = cellToText(dataRow[idx]);
}

function indexFaColumns(headers: string[]): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  const firstKeys = new Set(FA_FIRST_COLUMN_TITLES.map((t) => normalizeHeader(t)));
  headers.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (firstKeys.has(key) && out.ligne === undefined) {
      out.ligne = idx;
      return;
    }
    const alias = HEADER_ALIASES[key];
    if (alias && out[alias] === undefined) out[alias] = idx;
  });
  return out;
}

export const FA_EXPORT_HEADERS = [
  "NumLivrable",
  "Revision",
  "Jalon",
  "Version",
  "EstPrevisionnel",
  "DatePrevisionnelle",
  "ReponseFicheAvis",
  "FichierFicheAvis",
  "DateReceptionRATP",
  "DatePrevReceptionFA",
  "NumLotRATP",
  "CommentairesRATP",
  "CommentairesSupSurRetourRATP",
  "RefuseAuChargement",
  "NomUtilisateur",
];

export interface FaWorkbookRow {
  numLivrable: string;
  revision?: string;
  jalon?: string;
  version?: string;
  estPrevisionnel?: boolean | string;
  datePrevisionnelle?: string;
  reponseFicheAvis?: string;
  fichierFicheAvis?: string;
  dateReceptionRATP?: string;
  datePrevReceptionFA?: string;
  numLotRATP?: string;
  commentairesRATP?: string;
  commentairesSup?: string;
  refuseAuChargement?: string;
  nomUtilisateur?: string;
}

/** Build a synthetic ImportRetoursRATP workbook (not a production dump). */
export function buildFaImportAoa(rows: FaWorkbookRow[]): unknown[][] {
  const aoa: unknown[][] = [FA_EXPORT_HEADERS];
  for (const r of rows) {
    aoa.push([
      r.numLivrable,
      r.revision ?? "",
      r.jalon ?? "",
      r.version ?? "",
      r.estPrevisionnel === true ? "O" : r.estPrevisionnel === false ? "N" : (r.estPrevisionnel ?? ""),
      r.datePrevisionnelle ?? "",
      r.reponseFicheAvis ?? "",
      r.fichierFicheAvis ?? "",
      r.dateReceptionRATP ?? "",
      r.datePrevReceptionFA ?? "",
      r.numLotRATP ?? "",
      r.commentairesRATP ?? "",
      r.commentairesSup ?? "",
      r.refuseAuChargement ?? "",
      r.nomUtilisateur ?? "",
    ]);
  }
  return aoa;
}
