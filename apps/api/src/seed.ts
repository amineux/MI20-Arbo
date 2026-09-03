import type { SqlDatabase } from "./sql.js";

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

export interface SeedOptions {
  extraDocs?: number;
}

export async function seedIfEmpty(db: SqlDatabase): Promise<void> {
  const n = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM lookup_row");
  if ((n?.c ?? 0) > 0) return;
  const extra = Number(process.env.MI20_SEED_DOCS ?? 3000);
  await seed(db, { extraDocs: Number.isFinite(extra) && extra >= 0 ? extra : 3000 });
}

export async function seed(db: SqlDatabase, options?: SeedOptions): Promise<void> {
  await db.transaction(async () => {
    for (const t of LOOKUP_TABLES) {
      await db.run("INSERT OR IGNORE INTO lookup_table (table_key, label_fr) VALUES (?, ?)", [t.key, t.label]);
      for (const row of t.rows) {
        await db.run(
          `INSERT INTO lookup_row (table_key, nom, id_perimetre, id_domaine, id_metier)
           VALUES (?, ?, ?, ?, ?)`,
          [t.key, row.nom, row.idPerimetre ?? null, row.idDomaine ?? null, row.idMetier ?? null],
        );
      }
    }

    for (const code of JALON_CODES) {
      await db.run("INSERT OR IGNORE INTO jalon (Nom, Code) VALUES (?, ?)", [code, code]);
    }
    await db.run("INSERT OR IGNORE INTO version (Nom, Code) VALUES (?, ?)", ["FD", "FD"]);
    await db.run("INSERT OR IGNORE INTO version (Nom, Code) VALUES (?, ?)", ["AV", "AV"]);

    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["projectName", "MI20 Arbo"]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["versionIhm", "1.6.6-web"]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["bxTemplateName", "MI20_BORD_TEMPLATE_M5_V12.xls"]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["exportRatpMask", "C,AA,AB,AC"]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["nbJalonsPPD", "23"]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["titrePremiereColonneXLS_PPD", "Num Liv."]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["titrePremiereColonneXLS_PPD_rapide", "Nr Livrable"]);
    await db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["titrePremiereColonneXLS_RetoursRATP", "NumLivrable"]);

    const caf = await lookupId(db, "fournisseur", "CAF");
    const leader = await lookupId(db, "Leader", "CAF");
    const pic = await lookupId(db, "PIC", "PIC-10");
    const resp = await lookupId(db, "Responsable", "RESP DEMO");
    const domaineCh = await lookupId(db, "domaineChargeur", "ECLAIRAGE");
    const domaine = await lookupId(db, "domaine", "ECLAIRAGE");
    const dossier = await lookupId(db, "dossier", "DD");
    const jalonJd1 = await db.get<{ Id: number }>("SELECT Id FROM jalon WHERE Code = 'JD1'");
    if (!jalonJd1) throw new Error("Jalon JD1 missing after seed");

    const insertDoc = async (row: Record<string, unknown>) => {
      const ins = await db.run(
        `INSERT INTO document (
          RefExt, GroupeLigne, IndiceLigne, Revision, Livrable, Titre, Nom,
          IdLeader, IdFournisseur, IDPic, IdResponsable, IdDomaineChargeur, IdDomaineBord,
          IdTypeDossier, DelivrableProjet, Langue, Projet, EffMateriel, Homologuant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'FR', 'MI20', '', 0)`,
        [
          row.RefExt,
          row.GroupeLigne,
          row.IndiceLigne,
          row.Revision,
          row.Livrable,
          row.Titre,
          row.Nom,
          leader,
          caf,
          pic,
          resp,
          domaineCh,
          domaine,
          dossier,
        ],
      );
      return ins.lastInsertId;
    };

    const d1 = await insertDoc({
      RefExt: "CAF-ECH-007",
      GroupeLigne: 36,
      IndiceLigne: "9351.3",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD) (données de démonstration synthétiques)",
      Titre: "AXE CROCHET (ancien titre démo)",
      Nom: "Spécification de management",
    });

    await insertDoc({
      RefExt: "CAF-ECH-041",
      GroupeLigne: 36,
      IndiceLigne: "476",
      Revision: "A",
      Livrable: "36 - Dossiers de Définition (DD) (données de démonstration synthétiques)",
      Titre: "MONTAGE ISOLATION CABINE",
      Nom: "Note technique",
    });

    const d3 = await insertDoc({
      RefExt: "SYN-DOC-099",
      GroupeLigne: 40,
      IndiceLigne: "12",
      Revision: "B",
      Livrable: "40 - Dossiers de démonstration",
      Titre: "DOCUMENT SYNTHÉTIQUE HORS IMPORT",
      Nom: "Demo",
    });

    const pj = await db.run(
      `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, Version, Code, Revision)
       VALUES (?, ?, 1, 0, 'AV', 'JD1', 'A')`,
      [d1, jalonJd1.Id],
    );

    await db.run(
      `INSERT INTO doc_histo (IdDocument, GroupeLigne, IndiceLigne, FieldName, OldValue, NewValue, UserName, ChangedAt, IsImport)
       VALUES (?, 36, '9351.3', 'Titre', '', 'AXE CROCHET (ancien titre démo)', 'seed', ?, 0)`,
      [d1, new Date().toISOString()],
    );

    const rev = await db.run(
      `INSERT INTO revision (Revision, IdProgrammationJalon, NomUtilisateur, EstActive, FichierFicheAvis_AEnvoyer, IdDocument, Commentaire, CreatedAt)
       VALUES ('A', ?, 'seed', 1, 'FA_SEED_36_9351.3.pdf', ?, 'Indice initial — Form_CREATE_REV (démo synthétique).', ?)`,
      [pj.lastInsertId, d1, new Date().toISOString()],
    );

    const bx = await db.run(
      `INSERT INTO bordereau (IdLeader, Numero, DateEnvoi, NomComplet, EstActif, Commentaire)
       VALUES (?, 1, ?, 'MI20_BORD_CAF_0001', 1, 'Bordereau de démonstration (seed)')`,
      [leader, new Date().toISOString().slice(0, 10)],
    );
    await db.run(
      `INSERT INTO envoi (IdBordereau, IdRevision, IdDocument, Titre, Revision, NomUtilisateur)
       VALUES (?, ?, ?, 'AXE CROCHET (ancien titre démo)', 'A', 'seed')`,
      [bx.lastInsertId, rev.lastInsertId, d1],
    );

    await db.run(
      `INSERT INTO fiche_avis (
         IdEnvoi, IdDocument, IdRevision, NomFichier, Statut, DateSaisie, Commentaire,
         ReponseFicheAvis, NomUtilisateur, GroupeLigne, IndiceLigne, Revision, Jalon, FichierFicheAvis
       ) VALUES (
         (SELECT Id FROM envoi ORDER BY Id DESC LIMIT 1), ?, ?, 'FA_SEED_36_9351.3.pdf', 'FA', ?,
         'Fiche avis de démonstration (Form_SaisieRetoursRATP) — donnée synthétique.',
         'FA', 'seed', 36, '9351.3', 'A', 'JD1', 'FA_SEED_36_9351.3.pdf'
       )`,
      [d1, rev.lastInsertId, new Date().toISOString()],
    );

    void d3;
    const extra = options?.extraDocs ?? 0;
    if (extra > 0) {
      await seedSyntheticDocuments(db, {
        count: extra,
        leader,
        caf,
        pic,
        resp,
        domaineCh,
        domaine,
        dossier,
        jalonId: jalonJd1.Id,
      });
    }
  });
}

async function seedSyntheticDocuments(
  db: SqlDatabase,
  args: {
    count: number;
    leader: number;
    caf: number;
    pic: number;
    resp: number;
    domaineCh: number;
    domaine: number;
    dossier: number;
    jalonId: number;
  },
): Promise<void> {
  const jalonJs1 = await db.get<{ Id: number }>("SELECT Id FROM jalon WHERE Code = 'JS1'");
  for (let i = 0; i < args.count; i++) {
    const groupe = 100 + Math.floor(i / 50);
    const indice = String((i % 50) + 1);
    const ins = await db.run(
      `INSERT INTO document (
        RefExt, GroupeLigne, IndiceLigne, Revision, Livrable, Titre, Nom,
        IdLeader, IdFournisseur, IDPic, IdResponsable, IdDomaineChargeur, IdDomaineBord,
        IdTypeDossier, DelivrableProjet, Langue, Projet, EffMateriel, Homologuant
      ) VALUES (?, ?, ?, 'A', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'FR', 'MI20', '', 0)`,
      [
        `SYN-${groupe}-${indice}`,
        groupe,
        indice,
        `${groupe} - Livrables synthétiques (démo échelle)`,
        `DOCUMENT SYNTHETIQUE ${groupe} / ${indice}`,
        "Demo scale",
        args.leader,
        args.caf,
        args.pic,
        args.resp,
        args.domaineCh,
        args.domaine,
        args.dossier,
      ],
    );
    await db.run(
      `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, Version, Code, Revision)
       VALUES (?, ?, 0, 0, 'AV', 'JD1', 'A')`,
      [ins.lastInsertId, args.jalonId],
    );
    if (jalonJs1 && i % 3 === 0) {
      await db.run(
        `INSERT INTO programmation_jalon (IdDocument, IdJalon, IdVersion, EstPrevisionnel, Version, Code, Revision)
         VALUES (?, ?, 0, 1, 'FD', 'JS1', 'A')`,
        [ins.lastInsertId, jalonJs1.Id],
      );
    }
  }
}

export async function lookupId(db: SqlDatabase, table: string, nom: string): Promise<number> {
  const row = await db.get<{ id: number }>(
    "SELECT id FROM lookup_row WHERE table_key = ? AND UPPER(TRIM(nom)) = UPPER(TRIM(?))",
    [table, nom],
  );
  if (!row) throw new Error(`Lookup ${table}/${nom} missing after seed`);
  return row.id;
}

export async function loadLookupCatalog(db: SqlDatabase) {
  const rows = await db.all<{
    id: number;
    table_key: string;
    nom: string;
    id_perimetre: number | null;
    id_domaine: number | null;
    id_metier: number | null;
  }>("SELECT id, table_key, nom, id_perimetre, id_domaine, id_metier FROM lookup_row");
  const catalog: Record<
    string,
    Array<{ id: number; nom: string; idPerimetre?: number | null; idDomaine?: number | null; idMetier?: number | null }>
  > = {};
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

export async function dbStats(db: SqlDatabase) {
  const one = async (sql: string) => {
    const row = await db.get<{ c: number }>(sql);
    return Number(row?.c ?? 0);
  };
  return {
    documents: await one("SELECT COUNT(*) AS c FROM document"),
    jalonsProgrammes: await one("SELECT COUNT(*) AS c FROM programmation_jalon"),
    bordereaux: await one("SELECT COUNT(*) AS c FROM bordereau"),
    envois: await one("SELECT COUNT(*) AS c FROM envoi"),
    revisions: await one("SELECT COUNT(*) AS c FROM revision"),
    retoursRatp: await one("SELECT COUNT(*) AS c FROM fiche_avis"),
    histo: await one("SELECT COUNT(*) AS c FROM doc_histo"),
    dialect: db.dialect,
  };
}
