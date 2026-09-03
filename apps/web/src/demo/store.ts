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
  importFaRaw: Array<Record<string, unknown>>;
  bordereaux: Array<Record<string, unknown>>;
  envois: Array<Record<string, unknown>>;
  revisions: Array<Record<string, unknown>>;
  ratpReturns: Array<Record<string, unknown>>;
  files: Record<string, { type: string; b64: string }>;
}

const STORAGE_KEY = "mi20-arbo-static-demo-v5";

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
    importFaRaw: [],
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

  const jalonJs1 = state.jalons.find((j) => j.Code === "JS1")!;
  const jalonJp11 = state.jalons.find((j) => j.Code === "JP1.1")!;
  const now = new Date().toISOString();

  const docs: Array<Partial<DocumentRow> & { GroupeLigne: number; IndiceLigne: string; Titre: string }> = [
    {
      RefExt: "CAF-ECH-007",
      GroupeLigne: 36,
      IndiceLigne: "9351.3",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD)",
      Titre: "AXE CROCHET",
      Nom: "Spécification de management",
    },
    {
      RefExt: "CAF-ECH-041",
      GroupeLigne: 36,
      IndiceLigne: "476",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD)",
      Titre: "MONTAGE ISOLATION CABINE",
      Nom: "Note technique",
    },
    {
      RefExt: "CAF-ECH-088",
      GroupeLigne: 36,
      IndiceLigne: "880",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD)",
      Titre: "ÉCLAIRAGE CABINE CONDUCTEUR",
      Nom: "Dossier de définition",
    },
    {
      RefExt: "CAF-SCH-012",
      GroupeLigne: 12,
      IndiceLigne: "210",
      Revision: "A",
      Livrable: "12 - Schémas électriques",
      Titre: "SCHÉMA UNIFILAIRE ÉCLAIRAGE",
      Nom: "Schéma",
    },
    {
      RefExt: "CAF-NC-018",
      GroupeLigne: 18,
      IndiceLigne: "44.2",
      Revision: "B",
      Livrable: "18 - Notes de calcul",
      Titre: "NOTE DE CALCUL STRUCTURE CAISSE",
      Nom: "Note de calcul",
    },
    {
      RefExt: "CAF-PLN-022",
      GroupeLigne: 22,
      IndiceLigne: "1101",
      Revision: "A",
      Livrable: "22 - Plans d'implantation",
      Titre: "PLAN D'IMPLANTATION ÉQUIPEMENTS",
      Nom: "Plan",
    },
    {
      RefExt: "CAF-PRC-028",
      GroupeLigne: 28,
      IndiceLigne: "7",
      Revision: "A",
      Livrable: "28 - Procédures de contrôle",
      Titre: "PROCÉDURE DE CONTRÔLE EN USINE",
      Nom: "Procédure",
    },
    {
      RefExt: "CAF-NT-040",
      GroupeLigne: 40,
      IndiceLigne: "12",
      Revision: "B",
      Livrable: "40 - Notices techniques",
      Titre: "NOTICE TECHNIQUE HORS ANNEXE",
      Nom: "Notice",
    },
    {
      RefExt: "CAF-NU-045",
      GroupeLigne: 45,
      IndiceLigne: "3.1",
      Revision: "A",
      Livrable: "45 - Notices d'utilisation",
      Titre: "NOTICE D'UTILISATION CONDUCTEUR",
      Nom: "Notice d'utilisation",
    },
    {
      RefExt: "CAF-BM-050",
      GroupeLigne: 50,
      IndiceLigne: "19",
      Revision: "A",
      Livrable: "50 - Bilans de masse",
      Titre: "BILAN DE MASSE RAME",
      Nom: "Bilan",
    },
    {
      RefExt: "CAF-SM-008",
      GroupeLigne: 8,
      IndiceLigne: "101",
      Revision: "C",
      Livrable: "8 - Spécifications de management",
      Titre: "SPÉCIFICATION DE MANAGEMENT DOCUMENTAIRE",
      Nom: "Spécification",
    },
    {
      RefExt: "CAF-IF-015",
      GroupeLigne: 15,
      IndiceLigne: "33",
      Revision: "A",
      Livrable: "15 - Interfaces électriques",
      Titre: "INTERFACE ÉLECTRIQUE CABINE",
      Nom: "Interface",
    },
  ];

  for (const spec of docs) {
    state.documents.push({
      Id: alloc(state),
      ...baseDoc,
      ...spec,
    });
  }

  const byKey = (g: number, i: string) =>
    state.documents.find((d) => Number(d.GroupeLigne) === g && String(d.IndiceLigne) === i)!;
  const d1 = byKey(36, "9351.3");
  const d2 = byKey(36, "476");
  const dCalc = byKey(18, "44.2");
  const dSm = byKey(8, "101");

  const prog1 = {
    Id: alloc(state),
    IdDocument: d1.Id,
    IdJalon: jalonJd1.Id,
    IdVersion: 1,
    EstPrevisionnel: 0,
    DatePrevisionnelle: null,
    Version: "AV",
    Code: "JD1",
    Revision: "A",
  };
  state.programmation.push(
    prog1,
    {
      Id: alloc(state),
      IdDocument: d1.Id,
      IdJalon: jalonJs1.Id,
      IdVersion: 1,
      EstPrevisionnel: 1,
      DatePrevisionnelle: "2026-11-15",
      Version: "FD",
      Code: "JS1",
      Revision: "A",
    },
    {
      Id: alloc(state),
      IdDocument: d2.Id,
      IdJalon: jalonJd1.Id,
      IdVersion: 1,
      EstPrevisionnel: 0,
      DatePrevisionnelle: null,
      Version: "AV",
      Code: "JD1",
      Revision: "A",
    },
    {
      Id: alloc(state),
      IdDocument: dCalc.Id,
      IdJalon: jalonJp11.Id,
      IdVersion: 1,
      EstPrevisionnel: 0,
      DatePrevisionnelle: "2026-06-30",
      Version: "FD",
      Code: "JP1.1",
      Revision: "B",
    },
    {
      Id: alloc(state),
      IdDocument: dSm.Id,
      IdJalon: jalonJs1.Id,
      IdVersion: 1,
      EstPrevisionnel: 0,
      DatePrevisionnelle: null,
      Version: "FD",
      Code: "JS1",
      Revision: "C",
    },
  );
  state.histo.push(
    {
      Id: alloc(state),
      IdDocument: d1.Id,
      GroupeLigne: 36,
      IndiceLigne: "9351.3",
      FieldName: "Titre",
      OldValue: "",
      NewValue: "AXE CROCHET",
      UserName: "seed",
      ChangedAt: now,
      IsImport: 0,
    },
    {
      Id: alloc(state),
      IdDocument: dCalc.Id,
      GroupeLigne: 18,
      IndiceLigne: "44.2",
      FieldName: "Revision",
      OldValue: "A",
      NewValue: "B",
      UserName: "seed",
      ChangedAt: now,
      IsImport: 0,
    },
  );
  state.revisions.push({
    Id: alloc(state),
    Revision: "A",
    IdDocument: d1.Id,
    IdProgrammationJalon: prog1.Id,
    GroupeLigne: d1.GroupeLigne,
    IndiceLigne: d1.IndiceLigne,
    Titre: d1.Titre,
    NomUtilisateur: "seed",
    EstActive: 1,
    Commentaire: "Indice initial — jalon JD1.",
    CreatedAt: now,
  });
  state.revisions.push({
    Id: alloc(state),
    Revision: "B",
    IdDocument: dCalc.Id,
    IdProgrammationJalon: state.programmation.find((p) => p.IdDocument === dCalc.Id)?.Id ?? null,
    GroupeLigne: dCalc.GroupeLigne,
    IndiceLigne: dCalc.IndiceLigne,
    Titre: dCalc.Titre,
    NomUtilisateur: "seed",
    EstActive: 1,
    Commentaire: "Passage à l'indice B.",
    CreatedAt: now,
  });
  state.ratpReturns.push({
    Id: alloc(state),
    IdDocument: d1.Id,
    IdEnvoi: null as number | null,
    GroupeLigne: d1.GroupeLigne,
    IndiceLigne: d1.IndiceLigne,
    Titre: d1.Titre,
    Avis: "FA",
    ReponseFicheAvis: "FA",
    Statut: "FA",
    FichierFicheAvis: "FA_36_9351.3.pdf",
    NomFichier: "FA_36_9351.3.pdf",
    Commentaire: "Avis RATP sur AXE CROCHET — à reprendre.",
    NomUtilisateur: "seed",
    CreatedAt: now,
  });
  const bxId = alloc(state);
  state.bordereaux.push({
    Id: bxId,
    IdLeader: leader,
    Numero: 1,
    DateEnvoi: now.slice(0, 10),
    NomComplet: "MI20_BORD_CAF_0001",
    EstActif: 1,
    Commentaire: "Envoi CAF — lot éclairage cabine",
    ExportPath: null,
  });
  const envoiId = alloc(state);
  state.envois.push({
    Id: envoiId,
    IdBordereau: bxId,
    IdDocument: d1.Id,
    IdRevision: state.revisions[0]?.Id ?? null,
    Titre: d1.Titre,
    Revision: d1.Revision,
    NomUtilisateur: "seed",
  });
  const fa = state.ratpReturns[0];
  if (fa) fa.IdEnvoi = envoiId;
  return state;
}

let memory: DemoState | null = null;

export function getState(): DemoState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as DemoState;
      memory.importFaRaw ??= [];
      return memory;
    }
  } catch {
    /* ignore */
  }
  memory = createSeedState();
  saveState();
  return memory;
}

export function resetState(): DemoState {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return getState();
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
