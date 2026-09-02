import { DEFAULT_PPD_CONFIG } from "../src/types.js";
import type { JalonDef, LookupCatalog } from "../src/types.js";

export const sampleLookups: LookupCatalog = {
  Leader: [{ id: 2, nom: "CAF" }],
  PIC: [{ id: 10, nom: "PIC-10" }],
  Produit: [{ id: 1, nom: "MI20" }],
  Responsable: [{ id: 835, nom: "RESP DEMO" }],
  fournisseur: [
    { id: 1, nom: "CAF" },
    { id: 4, nom: "DEMO FOURNISSEUR" },
  ],
  metier: [{ id: 3, nom: "E" }],
  PreuveAutorisation: [{ id: 1, nom: "PA-1" }],
  NiveauConfidentialite: [{ id: 1, nom: "AT" }],
  NiveauCommunication: [{ id: 1, nom: "STD" }],
  domaine: [{ id: 30, nom: "ECLAIRAGE" }],
  domaineChargeur: [{ id: 4, nom: "ECLAIRAGE", idPerimetre: 2, idDomaine: 30, idMetier: 3 }],
  categorie: [{ id: 1, nom: "SPEC" }],
  categorieAT: [{ id: 1, nom: "NOTE" }],
  Perimetre: [{ id: 2, nom: "MATERIEL" }],
  dossier: [{ id: 4, nom: "DD" }],
  PourInfo_Acceptation: [{ id: 1, nom: "ACCEPTATION" }],
  modele_cao: [{ id: 1, nom: "N/A" }],
  logiciel_cao: [{ id: 1, nom: "N/A" }],
  TypeCode: [{ id: 7322, nom: "DOORS" }],
  Type_Envoi: [{ id: 1, nom: "O" }],
};

export const sampleJalons: JalonDef[] = [
  { id: 1, nom: "JS0", code: "JS0" },
  { id: 2, nom: "T0TF-1mois", code: "T0TF-1mois" },
  { id: 3, nom: "JS1", code: "JS1" },
  { id: 4, nom: "JS2", code: "JS2" },
  { id: 5, nom: "JD1", code: "JD1" },
];

const JALON_CODES = [
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

/** Build a full PPD matrix with import_columns headers + jalon range at cols 44–89. */
export function buildSamplePpdAoa(): unknown[][] {
  const width = DEFAULT_PPD_CONFIG.lastPpdCol;
  const header: unknown[] = new Array(width).fill("");
  header[0] = "Num Liv.";
  header[1] = "Livrable de l'annexe 1 de la SM";
  header[2] = "Référence externe (Titulaire)";
  header[3] = "Indice de révision";
  header[4] = "Titre du document";
  header[5] = "Délivrable Projet (O/N)";
  header[6] = 'Ligne PPD couverte par un autre "N° de ligne';
  header[7] = "Référence du document source";
  header[8] = "Nom du document source";
  header[9] = "§ du document source";
  header[10] = "Leader technique (Titulaire)";
  header[11] = "P I C (Code Arbo produit)";
  header[12] = "Support (lié au PIC)";
  header[13] = "Produit";
  header[14] = "RESPONSABLE TITULAIRE";
  header[15] = "Fournisseur";
  header[16] = "Référence fournisseur";
  header[17] = "Métier Groupement";
  header[18] = "Preuve Autorisation";
  header[19] = "Doc confidentiel (O/N) (Colonne H du chargeur)";
  header[20] = "Niveau de confidentialité (AT/CAF/Fournisseur)";
  header[21] = "Niveau de Communication";
  header[22] = "Type Document";
  header[23] = "Domaine RATP";
  header[24] = "Domaine chargeur";
  header[25] = "Catégorie du document";
  header[26] = "Catégorie doc RATP";
  header[27] = "Périmètre RATP";
  header[28] = "Dossier";
  header[29] = "Pour acceptation/pour information";
  header[30] = "Doc sécuritaire";
  header[31] = "Modèle CAO";
  header[32] = "Logiciel CAO";
  header[33] = "Date de la prochaine soumission";
  header[34] = "Commentaires";
  header[35] = "Homologuant";
  header[36] = "Type Code DOORS";
  header[37] = "Filiation";
  header[38] = "Langue";
  header[39] = "Projet";
  header[40] = "Métier";
  header[41] = "Envoi par Bordereau (O/N)";

  for (let i = 0; i < DEFAULT_PPD_CONFIG.jalonCount; i++) {
    header[DEFAULT_PPD_CONFIG.firstJalonCol - 1 + i] = JALON_CODES[i] ?? `J${i + 1}`;
    header[DEFAULT_PPD_CONFIG.firstJalonDateCol - 1 + i] = `Date ${JALON_CODES[i] ?? i + 1}`;
  }

  const row = (
    ligne: string,
    titre: string,
    ref: string,
    fournisseur: string,
    extra?: Partial<{ livrable: string }>,
  ): unknown[] => {
    const r: unknown[] = new Array(width).fill("");
    r[0] = ligne;
    r[1] = extra?.livrable ?? "36 - Dossiers de Définition (DD) incluant l'aptitude au soutien";
    r[2] = ref;
    r[3] = "A";
    r[4] = titre;
    r[5] = "O";
    r[10] = "CAF";
    r[11] = "PIC-10";
    r[13] = "MI20";
    r[14] = "RESP DEMO";
    r[15] = fournisseur;
    r[17] = "E";
    r[23] = "ECLAIRAGE";
    r[24] = "ECLAIRAGE";
    r[27] = "MATERIEL";
    r[28] = "DD";
    r[33] = "";
    r[35] = "N";
    r[36] = "DOORS";
    r[38] = "FR";
    r[39] = "MI20";
    r[41] = "O";
    r[DEFAULT_PPD_CONFIG.firstJalonCol - 1] = "JS0 30/06/2021";
    r[DEFAULT_PPD_CONFIG.firstJalonCol - 1 + 4] = "FD";
    return r;
  };

  return [
    header,
    row("36 / 9351.3", "AXE CROCHET", "CAF-ECH-007", "CAF"),
    row("36 / 1001", "DOC ERREUR FOURNISSEUR", "SYN-ERR-001", "OUEST INDUSTRIE"),
    row("36 / 2002", "SUPPORT PLOTS BAS", "CAF-ECH-021", "CAF"),
  ];
}
