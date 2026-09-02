export type ColumnNature =
  | "T"
  | "TITRE"
  | "LIGNE"
  | "LDD"
  | "LDDDomaineChargeur"
  | "OUINON"
  | "J"
  | "AUTORISANT";

export interface ImportColumn {
  id: number;
  documentField: string;
  ppdTitle: string;
  nature: ColumnNature;
  associatedTable: string | null;
  toImport: boolean;
  destTable: string;
}

export interface PpdConfig {
  firstColumnTitle: string;
  firstColumnTitleRapide: string;
  lastColumnTitle: string;
  firstJalonCol: number;
  lastJalonCol: number;
  firstJalonDateCol: number;
  lastJalonDateCol: number;
  jalonCount: number;
  lastPpdCol: number;
  lastChangeCol: number;
  ratpMaskedColumns: string[];
  rapide: boolean;
}

export const DEFAULT_PPD_CONFIG: PpdConfig = {
  firstColumnTitle: "Num Liv.",
  firstColumnTitleRapide: "Nr Livrable",
  lastColumnTitle: "Date de la prochaine soumission",
  firstJalonCol: 44,
  lastJalonCol: 66,
  firstJalonDateCol: 67,
  lastJalonDateCol: 89,
  jalonCount: 23,
  lastPpdCol: 161,
  lastChangeCol: 162,
  ratpMaskedColumns: ["C", "AA", "AB", "AC"],
  rapide: false,
};

export const RAPIDE_FIELD_ALLOWLIST = new Set([
  "GroupeLigne",
  "Revision",
  "DateResoumission",
  "Jalon",
]);

export interface LookupRow {
  id: number;
  nom: string;
  idPerimetre?: number | null;
  idDomaine?: number | null;
  idMetier?: number | null;
}

export interface LookupCatalog {
  [table: string]: LookupRow[];
}

export interface JalonSlot {
  index: number;
  nom: string;
  valeur: string;
  date: string | null;
  estPrevisionnel: boolean;
}

export interface StagedDocument {
  ligneExcel: number;
  groupeLigne: number | null;
  indiceLigne: string;
  fields: Record<string, unknown>;
  displayFields: Record<string, string>;
  jalons: JalonSlot[];
  errors: string[];
  isNew: boolean;
}

export interface CompareRow {
  groupeLigne: number;
  indiceLigne: string;
  titreFr: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  oldValueBrut: string;
  newValueBrut: string;
  isImported: boolean;
  nouveauDocument: boolean;
  table: string;
  oldEstPrevisionnel: boolean;
  newEstPrevisionnel: boolean;
}

export interface DocumentSnapshot {
  id?: number;
  groupeLigne: number;
  indiceLigne: string;
  fields: Record<string, unknown>;
  jalons: Array<{
    idJalon: number;
    code: string;
    nom?: string;
    valeur: string;
    date: string | null;
    estPrevisionnel: boolean;
    idVersion?: number;
  }>;
}

export interface JalonDef {
  id: number;
  nom: string;
  code: string;
}

export const JALON_SLOT_COUNT = 24;
