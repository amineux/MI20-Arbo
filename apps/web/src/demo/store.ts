export const LOOKUP_TABLES: Array<{
  key: string;
  label: string;
  rows: Array<{ nom: string; idPerimetre?: number; idDomaine?: number; idMetier?: number }>;
}> = [
  { key: "Leader", label: "Leader technique", rows: [{ nom: "CAF" }, { nom: "DEMO LEADER" }] },
  { key: "PIC", label: "PIC", rows: [{ nom: "PIC-10" }, { nom: "PIC-20" }] },
  { key: "Produit", label: "Produit", rows: [{ nom: "MI20" }] },
  { key: "Responsable", label: "Responsable titulaire", rows: [{ nom: "RESP DEMO" }] },
  { key: "fournisseur", label: "Fournisseur", rows: [{ nom: "CAF" }, { nom: "DEMO FOURNISSEUR" }] },
  { key: "metier", label: "Métier groupement", rows: [{ nom: "E" }, { nom: "M" }] },
  { key: "PreuveAutorisation", label: "Preuve autorisation", rows: [{ nom: "PA-1" }] },
  { key: "NiveauConfidentialite", label: "Niveau de confidentialité", rows: [{ nom: "AT" }, { nom: "CAF" }] },
  { key: "NiveauCommunication", label: "Niveau de communication", rows: [{ nom: "STD" }] },
  { key: "domaine", label: "Domaine RATP", rows: [{ nom: "ECLAIRAGE" }, { nom: "CABINE" }] },
  {
    key: "domaineChargeur",
    label: "Domaine chargeur",
    rows: [{ nom: "ECLAIRAGE", idPerimetre: 1, idDomaine: 1, idMetier: 1 }],
  },
  { key: "categorie", label: "Catégorie", rows: [{ nom: "SPEC" }, { nom: "NOTE" }] },
  { key: "categorieAT", label: "Catégorie doc RATP", rows: [{ nom: "NOTE" }] },
  { key: "Perimetre", label: "Périmètre RATP", rows: [{ nom: "MATERIEL" }] },
  { key: "dossier", label: "Dossier", rows: [{ nom: "DD" }, { nom: "DQ" }] },
  { key: "PourInfo_Acceptation", label: "Pour acceptation / pour information", rows: [{ nom: "ACCEPTATION" }, { nom: "INFO" }] },
  { key: "modele_cao", label: "Modèle CAO", rows: [{ nom: "N/A" }] },
  { key: "logiciel_cao", label: "Logiciel CAO", rows: [{ nom: "N/A" }] },
  { key: "TypeCode", label: "Type code DOORS", rows: [{ nom: "DOORS" }] },
  { key: "Type_Envoi", label: "Type d'envoi", rows: [{ nom: "O" }, { nom: "N" }] },
  { key: "origine", label: "Origine", rows: [{ nom: "TITULAIRE" }] },
  { key: "type_document", label: "Type document", rows: [{ nom: "PDF" }] },
];

export const JALON_CODES = [
  "JS0",
  "T0TF-1mois",
  "JS1",
  "JS2",
  "JD1",
  "JD2.1",
  "JD2.2",
  "JP1.1",
  "JP1.2",
  "JP2.1.E1",
  "JP3.E1",
  "JP2.2",
  "JA1.1",
  "JP2.1.E2",
  "JA2.1",
  "JA1.2",
  "JP2.1.Ei",
  "JP3.Ei",
  "JA2.2",
  "JU1.1",
  "JU1.2",
  "JU2.E1",
  "JU2.Ei",
];

export interface LookupRow {
  id: number;
  table_key: string;
  nom: string;
  id_perimetre: number | null;
  id_domaine: number | null;
  id_metier: number | null;
}

export interface DocumentRow {
  Id: number;
  [key: string]: unknown;
}

export interface JalonProg {
  Id: number;
  IdDocument: number;
  IdJalon: number;
  IdVersion: number;
  EstPrevisionnel: number;
  DatePrevisionnelle: string | null;
  Version: string;
  Code: string;
  Revision: string | null;
}

export interface DemoState {
  nextId: number;
  lock: { id: number; locked: number; message: string | null; locked_by: string | null; locked_at: string | null };
  lookupTables: Array<{ table_key: string; label_fr: string }>;
  lookupRows: LookupRow[];
  jalons: Array<{ Id: number; Nom: string; Code: string }>;
  documents: DocumentRow[];
  programmation: JalonProg[];
  histo: Array<Record<string, unknown>>;
  importBatches: Array<Record<string, unknown>>;
  importRaw: Array<Record<string, unknown>>;
  importCompare: Array<Record<string, unknown>>;
  bordereaux: Array<Record<string, unknown>>;
  envois: Array<Record<string, unknown>>;
  revisions: Array<Record<string, unknown>>;
  ratpReturns: Array<Record<string, unknown>>;
  files: Record<string, { type: string; b64: string }>;
}

const STORAGE_KEY = "mi20-arbo-static-demo-v2";

function alloc(state: DemoState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function lookupId(state: DemoState, table: string, nom: string): number {
  const row = state.lookupRows.find(
    (r) => r.table_key === table && r.nom.trim().toUpperCase() === nom.trim().toUpperCase(),
  );
  if (!row) throw new Error(`Lookup ${table}/${nom} missing`);
  return row.id;
}

export function createSeedState(): DemoState {
  const state: DemoState = {
    nextId: 1,
    lock: { id: 1, locked: 0, message: null, locked_by: null, locked_at: null },
    lookupTables: [],
    lookupRows: [],
    jalons: [],
    documents: [],
    programmation: [],
    histo: [],
    importBatches: [],
    importRaw: [],
    importCompare: [],
    bordereaux: [],
    envois: [],
    revisions: [],
    ratpReturns: [],
    files: {},
  };

  for (const t of LOOKUP_TABLES) {
    state.lookupTables.push({ table_key: t.key, label_fr: t.label });
    for (const row of t.rows) {
      state.lookupRows.push({
        id: alloc(state),
        table_key: t.key,
        nom: row.nom,
        id_perimetre: row.idPerimetre ?? null,
        id_domaine: row.idDomaine ?? null,
        id_metier: row.idMetier ?? null,
      });
    }
  }
  for (const code of JALON_CODES) {
    state.jalons.push({ Id: alloc(state), Nom: code, Code: code });
  }

  const caf = lookupId(state, "fournisseur", "CAF");
  const leader = lookupId(state, "Leader", "CAF");
  const pic = lookupId(state, "PIC", "PIC-10");
  const resp = lookupId(state, "Responsable", "RESP DEMO");
  const domaineCh = lookupId(state, "domaineChargeur", "ECLAIRAGE");
  const domaine = lookupId(state, "domaine", "ECLAIRAGE");
  const dossier = lookupId(state, "dossier", "DD");
  const jalonJd1 = state.jalons.find((j) => j.Code === "JD1")!;

  const baseDoc = {
    IdLeader: leader,
    IdFournisseur: caf,
    IDPic: pic,
    IdResponsable: resp,
    IdDomaineChargeur: domaineCh,
    IdDomaineBord: domaine,
    IdTypeDossier: dossier,
    DelivrableProjet: 1,
    Langue: "FR",
    Projet: "MI20",
    EffMateriel: "",
    Homologuant: 0,
  };

  const d1: DocumentRow = {
    Id: alloc(state),
    RefExt: "CAF-ECH-007",
    GroupeLigne: 36,
    IndiceLigne: "9351.3",
    Revision: "A",
    Livrable: "36 - Dossiers de Définition (DD) (données de démonstration synthétiques)",
    Titre: "AXE CROCHET (ancien titre démo)",
    Nom: "Spécification de management",
    ...baseDoc,
  };
  const d2: DocumentRow = {
    Id: alloc(state),
    RefExt: "CAF-ECH-041",
    GroupeLigne: 36,
    IndiceLigne: "476",
    Revision: "A",
    Livrable: "36 - Dossiers de Définition (DD) (données de démonstration synthétiques)",
    Titre: "MONTAGE ISOLATION CABINE",
    Nom: "Note technique",
    ...baseDoc,
  };
  const d3: DocumentRow = {
    Id: alloc(state),
    RefExt: "SYN-DOC-099",
    GroupeLigne: 40,
    IndiceLigne: "12",
    Revision: "B",
    Livrable: "40 - Dossiers de démonstration",
    Titre: "DOCUMENT SYNTHÉTIQUE HORS IMPORT",
    Nom: "Demo",
    ...baseDoc,
  };
  state.documents.push(d1, d2, d3);
  state.programmation.push({
    Id: alloc(state),
    IdDocument: d1.Id,
    IdJalon: jalonJd1.Id,
    IdVersion: 1,
    EstPrevisionnel: 0,
    DatePrevisionnelle: null,
    Version: "AV",
    Code: "JD1",
    Revision: "A",
  });
  state.histo.push({
    Id: alloc(state),
    IdDocument: d1.Id,
    GroupeLigne: 36,
    IndiceLigne: "9351.3",
    FieldName: "Titre",
    OldValue: "",
    NewValue: "AXE CROCHET (ancien titre démo)",
    UserName: "seed",
    ChangedAt: new Date().toISOString(),
    IsImport: 0,
  });
  return state;
}

let memory: DemoState | null = null;

export function getState(): DemoState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as DemoState;
      return memory;
    }
  } catch {
    /* ignore */
  }
  memory = createSeedState();
  saveState();
  return memory;
}

export function saveState(): void {
  if (!memory) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* quota */
  }
}

export function nextId(): number {
  return alloc(getState());
}

export function lookupName(id: number | null | undefined): string | undefined {
  if (id == null) return undefined;
  return getState().lookupRows.find((r) => r.id === Number(id))?.nom;
}

export function loadLookupCatalog() {
  const catalog: Record<string, Array<{ id: number; nom: string; idPerimetre?: number | null; idDomaine?: number | null; idMetier?: number | null }>> = {};
  for (const r of getState().lookupRows) {
    const item = {
      id: r.id,
      nom: r.nom,
      idPerimetre: r.id_perimetre,
      idDomaine: r.id_domaine,
      idMetier: r.id_metier,
    };
    (catalog[r.table_key] ??= []).push(item);
    const lower = r.table_key.toLowerCase();
    if (lower !== r.table_key) (catalog[lower] ??= []).push(item);
  }
  return catalog;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
