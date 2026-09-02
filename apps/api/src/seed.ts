import type Database from "better-sqlite3";

interface Named {
  nom: string;
  idPerimetre?: number;
  idDomaine?: number;
  idMetier?: number;
}

const LOOKUP_TABLES: Array<{ key: string; label: string; rows: Named[] }> = [
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

export function seedIfEmpty(db: Database.Database): void {
  const n = db.prepare("SELECT COUNT(*) AS c FROM lookup_row").get() as { c: number };
  if (n.c > 0) return;
  seed(db);
}

export function seed(db: Database.Database): void {
  const insertTable = db.prepare("INSERT OR IGNORE INTO lookup_table (table_key, label_fr) VALUES (?, ?)");
  const insertRow = db.prepare(
    `INSERT INTO lookup_row (table_key, nom, id_perimetre, id_domaine, id_metier)
     VALUES (@table_key, @nom, @id_perimetre, @id_domaine, @id_metier)`,
  );

  const tx = db.transaction(() => {
    for (const t of LOOKUP_TABLES) {
      insertTable.run(t.key, t.label);
      for (const row of t.rows) {
        insertRow.run({
          table_key: t.key,
          nom: row.nom,
          id_perimetre: row.idPerimetre ?? null,
          id_domaine: row.idDomaine ?? null,
          id_metier: row.idMetier ?? null,
        });
      }
    }

    const insertJalon = db.prepare("INSERT OR IGNORE INTO jalon (Nom, Code) VALUES (?, ?)");
    for (const code of JALON_CODES) insertJalon.run(code, code);
    db.prepare("INSERT OR IGNORE INTO version (Nom, Code) VALUES (?, ?)").run("FD", "FD");
    db.prepare("INSERT OR IGNORE INTO version (Nom, Code) VALUES (?, ?)").run("AV", "AV");

    db.prepare(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES
        ('projectName', 'MI20 Arbo'),
        ('versionIhm', '1.6.6-web'),
        ('bxTemplateName', 'MI20_BORD_TEMPLATE_M5_V12.xls'),
        ('exportRatpMask', 'C,AA,AB,AC'),
        ('nbJalonsPPD', '23'),
        ('titrePremiereColonneXLS_PPD', 'Num Liv.'),
        ('titrePremiereColonneXLS_PPD_rapide', 'Nr Livrable')`,
    ).run();

    const caf = lookupId(db, "fournisseur", "CAF");
    const leader = lookupId(db, "Leader", "CAF");
    const pic = lookupId(db, "PIC", "PIC-10");
    const resp = lookupId(db, "Responsable", "RESP DEMO");
    const domaineCh = lookupId(db, "domaineChargeur", "ECLAIRAGE");
    const domaine = lookupId(db, "domaine", "ECLAIRAGE");
    const dossier = lookupId(db, "dossier", "DD");
    const jalonJd1 = db.prepare("SELECT Id FROM jalon WHERE Code = 'JD1'").get() as { Id: number };

    const insertDoc = db.prepare(`
      INSERT INTO document (
        RefExt, GroupeLigne, IndiceLigne, Revision, Livrable, Titre, Nom,
        IdLeader, IdFournisseur, IDPic, IdResponsable, IdDomaineChargeur, IdDomaineBord,
        IdTypeDossier, DelivrableProjet, Langue, Projet, EffMateriel, Homologuant
      ) VALUES (
        @RefExt, @GroupeLigne, @IndiceLigne, @Revision, @Livrable, @Titre, @Nom,
        @IdLeader, @IdFournisseur, @IDPic, @IdResponsable, @IdDomaineChargeur, @IdDomaineBord,
        @IdTypeDossier, 1, 'FR', 'MI20', '', 0
      )
    `);

    const d1 = insertDoc.run({
      RefExt: "CAF-ECH-007",
      GroupeLigne: 36,
      IndiceLigne: "9351.3",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD) (données de démonstration synthétiques)",
      Titre: "AXE CROCHET (ancien titre démo)",
      Nom: "Spécification de management",
      IdLeader: leader,
      IdFournisseur: caf,
      IDPic: pic,
      IdResponsable: resp,
      IdDomaineChargeur: domaineCh,
      IdDomaineBord: domaine,
      IdTypeDossier: dossier,
    });

    insertDoc.run({
      RefExt: "CAF-ECH-041",
      GroupeLigne: 36,
      IndiceLigne: "476",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD) (données de démonstration synthétiques)",
      Titre: "MONTAGE ISOLATION CABINE",
      Nom: "Note technique",
      IdLeader: leader,
      IdFournisseur: caf,
      IDPic: pic,
      IdResponsable: resp,
      IdDomaineChargeur: domaineCh,
      IdDomaineBord: domaine,
      IdTypeDossier: dossier,
    });

    insertDoc.run({
      RefExt: "SYN-DOC-099",
      GroupeLigne: 40,
      IndiceLigne: "12",
      Revision: "B",
      Livrable: "40 - Dossiers de démonstration",
      Titre: "DOCUMENT SYNTHÉTIQUE HORS IMPORT",
      Nom: "Demo",
      IdLeader: leader,
      IdFournisseur: caf,
      IDPic: pic,
      IdResponsable: resp,
      IdDomaineChargeur: domaineCh,
      IdDomaineBord: domaine,
      IdTypeDossier: dossier,
    });

    db.prepare(
      `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, Version, Code, Revision)
       VALUES (?, ?, 1, 0, 'AV', 'JD1', 'A')`,
    ).run(d1.lastInsertRowid, jalonJd1.Id);

    db.prepare(
      `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
       VALUES (?, 36, '9351.3', 'Titre', '', 'AXE CROCHET (ancien titre démo)', 'seed', datetime('now'), 0)`,
    ).run(d1.lastInsertRowid);
  });
  tx();
}

export function lookupId(db: Database.Database, table: string, nom: string): number {
  const row = db
    .prepare("SELECT id FROM lookup_row WHERE table_key = ? AND UPPER(TRIM(nom)) = UPPER(TRIM(?))")
    .get(table, nom) as { id: number } | undefined;
  if (!row) throw new Error(`Lookup ${table}/${nom} missing after seed`);
  return row.id;
}

export function loadLookupCatalog(db: Database.Database) {
  const rows = db
    .prepare(
      "SELECT id, table_key, nom, id_perimetre, id_domaine, id_metier FROM lookup_row",
    )
    .all() as Array<{
    id: number;
    table_key: string;
    nom: string;
    id_perimetre: number | null;
    id_domaine: number | null;
    id_metier: number | null;
  }>;
  const catalog: Record<string, Array<{ id: number; nom: string; idPerimetre?: number | null; idDomaine?: number | null; idMetier?: number | null }>> = {};
  for (const r of rows) {
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
