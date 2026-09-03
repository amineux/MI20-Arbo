export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  locked_by TEXT,
  locked_at TEXT
);
INSERT OR IGNORE INTO app_lock (id, locked, message) VALUES (1, 0, NULL);

CREATE TABLE IF NOT EXISTS lookup_table (
  table_key TEXT PRIMARY KEY,
  label_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lookup_row (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_key TEXT NOT NULL,
  nom TEXT NOT NULL,
  id_perimetre INTEGER,
  id_domaine INTEGER,
  id_metier INTEGER,
  extra_json TEXT,
  UNIQUE (table_key, nom COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS document (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  RefExt TEXT NOT NULL DEFAULT '',
  GroupeLigne INTEGER NOT NULL,
  IndiceLigne TEXT NOT NULL DEFAULT '',
  IdLeader INTEGER,
  IdCoediteur INTEGER,
  IdCategorie INTEGER,
  IdCategorieAT INTEGER,
  IdDomaineBord INTEGER,
  IdFournisseur INTEGER,
  IdTypeDossier INTEGER,
  IdOrigine INTEGER,
  IdLogicielCAO INTEGER,
  IdModeleCAO INTEGER,
  QteEstimeeDocs TEXT,
  Revision TEXT NOT NULL DEFAULT '',
  EstConfidentiel INTEGER NOT NULL DEFAULT 0,
  RefExtParent TEXT,
  IdResponsable INTEGER,
  Livrable TEXT NOT NULL DEFAULT '',
  RefRATP TEXT,
  EffMateriel TEXT NOT NULL DEFAULT '',
  Poste TEXT,
  IdDomaineChargeur INTEGER,
  IdMetier INTEGER,
  N_MF19 TEXT,
  Nom TEXT,
  Sections TEXT,
  Categorie TEXT,
  DocumentsConnexes TEXT,
  CommentaireBT TEXT,
  Titre TEXT,
  Tranche TEXT,
  SiteEmetteur TEXT,
  NomsInformatiques TEXT,
  RefPDMdocFNR TEXT,
  RelecturePartenaire TEXT,
  Affaire TEXT,
  ApplicationMateriel TEXT,
  DocReferentiel TEXT,
  EstSecuritaire INTEGER NOT NULL DEFAULT 0,
  RFA INTEGER NOT NULL DEFAULT 0,
  DemandeSortieTemporaire INTEGER NOT NULL DEFAULT 0,
  IDPic INTEGER,
  IDPerimetre INTEGER,
  DelivrableProjet INTEGER NOT NULL DEFAULT 0,
  LignePPDCouverteParAutreNumero TEXT,
  IdPicSupport INTEGER,
  IdProduit INTEGER,
  IdNiveauConfidentialite INTEGER,
  IdNiveauCommunication INTEGER,
  IdPourInfo_Acceptation INTEGER,
  RefDocumentSource TEXT,
  IdPreuveAutorisation INTEGER,
  Homologuant INTEGER NOT NULL DEFAULT 0,
  IdTypeCode INTEGER,
  DateResoumission TEXT,
  Langue TEXT,
  Projet TEXT,
  Metier TEXT,
  IdTypeEnvoi INTEGER,
  Service TEXT,
  FournitureNatif TEXT,
  UNIQUE (GroupeLigne, IndiceLigne)
);

CREATE INDEX IF NOT EXISTS ix_document_refext ON document (RefExt);
CREATE INDEX IF NOT EXISTS ix_document_titre ON document (Titre);

CREATE TABLE IF NOT EXISTS jalon (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Nom TEXT NOT NULL,
  Code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS version (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Nom TEXT NOT NULL,
  Code TEXT
);

CREATE TABLE IF NOT EXISTS programmation_jalon (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  IdDocument INTEGER NOT NULL REFERENCES document(Id) ON DELETE CASCADE,
  IdJalon INTEGER NOT NULL,
  IdVersion INTEGER NOT NULL DEFAULT 0,
  EstPrevisionnel INTEGER NOT NULL DEFAULT 0,
  DatePrevisionnelle TEXT,
  DemandeSortieTemporaire INTEGER NOT NULL DEFAULT 0,
  NbEnvoisNecessairesAvantAcceptation INTEGER,
  PourcAvancement INTEGER,
  Version TEXT,
  Code TEXT,
  Revision TEXT,
  UNIQUE (IdDocument, IdJalon)
);

CREATE TABLE IF NOT EXISTS revision (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Revision TEXT NOT NULL,
  IdProgrammationJalon INTEGER NOT NULL,
  NomUtilisateur TEXT NOT NULL DEFAULT '',
  EstActive INTEGER NOT NULL DEFAULT 1,
  FichierFicheAvis_AEnvoyer TEXT,
  IdTypeDocument INTEGER,
  flagEnCoursImport INTEGER NOT NULL DEFAULT 0,
  IdType_mise_a_jour INTEGER
);

CREATE TABLE IF NOT EXISTS bordereau (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  IdLeader INTEGER NOT NULL,
  Numero INTEGER NOT NULL,
  DateEnvoi TEXT,
  NomComplet TEXT NOT NULL UNIQUE,
  EstActif INTEGER NOT NULL DEFAULT 1,
  DateReceptionRATP TEXT,
  flagEnCoursImport INTEGER NOT NULL DEFAULT 0,
  indiceRejet TEXT,
  Commentaire TEXT,
  ExportPath TEXT
);

CREATE TABLE IF NOT EXISTS envoi (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  IdBordereau INTEGER NOT NULL REFERENCES bordereau(Id) ON DELETE CASCADE,
  IdRevision INTEGER,
  IdDocument INTEGER NOT NULL,
  IdDomaine INTEGER,
  IdCategorieAT INTEGER,
  IdVersionEnvoyee INTEGER,
  Revision TEXT,
  Titre TEXT NOT NULL DEFAULT '',
  DateReceptionRATP TEXT,
  DatePrevReceptionFA TEXT,
  DelaiExamenRATP INTEGER,
  DateEnvoiFACAF TEXT,
  NomUtilisateur TEXT,
  NumLotRATP TEXT,
  FichierFicheAvis_Envoye TEXT,
  ReponseFicheAvis TEXT,
  DateReponseFATitulaire TEXT,
  RefuseAuChargement TEXT,
  CommentairesRATP TEXT,
  CommentairesSupSurRetourRATP TEXT,
  flagEnCoursImport INTEGER NOT NULL DEFAULT 0,
  IdType_mise_a_jour INTEGER,
  Document_Pere TEXT,
  FichierAttache TEXT
);

CREATE TABLE IF NOT EXISTS fiche_avis (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  IdEnvoi INTEGER REFERENCES envoi(Id) ON DELETE CASCADE,
  NomFichier TEXT,
  Statut TEXT,
  DateSaisie TEXT,
  Commentaire TEXT
);

CREATE TABLE IF NOT EXISTS doc_histo (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  IdDocument INTEGER,
  GroupeLigne INTEGER,
  IndiceLigne TEXT,
  FieldName TEXT NOT NULL,
  OldValue TEXT,
  NewValue TEXT,
  UserName TEXT,
  ChangedAt TEXT NOT NULL,
  IsImport INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_batch (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  ImportUser TEXT NOT NULL,
  ImportTime TEXT NOT NULL,
  FileName TEXT,
  Mode TEXT NOT NULL DEFAULT 'full',
  Status TEXT NOT NULL DEFAULT 'staged',
  Warning TEXT,
  RowCount INTEGER NOT NULL DEFAULT 0,
  ErrorCount INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_raw (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  BatchId INTEGER NOT NULL REFERENCES import_batch(Id) ON DELETE CASCADE,
  ImportUser TEXT NOT NULL,
  ImportTime TEXT,
  GroupeLigne INTEGER,
  IndiceLigne TEXT,
  ligneEXCEL INTEGER,
  erreur TEXT,
  NouveauDocument INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  jalon_json TEXT
);
CREATE INDEX IF NOT EXISTS ix_import_raw_key ON import_raw (GroupeLigne, IndiceLigne);

CREATE TABLE IF NOT EXISTS import_compare (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  BatchId INTEGER NOT NULL REFERENCES import_batch(Id) ON DELETE CASCADE,
  GroupeLigne INTEGER NOT NULL,
  IndiceLigne TEXT NOT NULL,
  titre_fr TEXT NOT NULL DEFAULT '',
  fieldName TEXT NOT NULL,
  fieldLabel TEXT NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  isImported INTEGER NOT NULL DEFAULT 0,
  bx TEXT,
  NouveauDocument INTEGER NOT NULL DEFAULT 0,
  "table" TEXT,
  oldValue_brut TEXT,
  newValue_brut TEXT,
  oldEstPrevisionnel INTEGER NOT NULL DEFAULT 0,
  newEstPrevisionnel INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_programmation_jalon (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  BatchId INTEGER NOT NULL,
  IdDocument INTEGER,
  IdJalon INTEGER NOT NULL,
  IdVersion INTEGER NOT NULL DEFAULT 0,
  EstPrevisionnel INTEGER NOT NULL DEFAULT 0,
  DatePrevisionnelle TEXT,
  Version TEXT,
  Code TEXT,
  Revision TEXT,
  GroupeLigne INTEGER,
  IndiceLigne TEXT
);
`;

export const SQLITE_PRAGMAS = [
  "foreign_keys = ON",
  "journal_mode = WAL",
  "synchronous = NORMAL",
  "busy_timeout = 5000",
  "cache_size = -80000",
];

export const SCHEMA_EXTRAS_SQL = `
CREATE INDEX IF NOT EXISTS ix_pj_document ON programmation_jalon (IdDocument);
CREATE INDEX IF NOT EXISTS ix_pj_jalon ON programmation_jalon (IdJalon);
CREATE INDEX IF NOT EXISTS ix_envoi_bordereau ON envoi (IdBordereau);
CREATE INDEX IF NOT EXISTS ix_envoi_document ON envoi (IdDocument);
CREATE INDEX IF NOT EXISTS ix_envoi_revision ON envoi (IdRevision);
CREATE INDEX IF NOT EXISTS ix_revision_pj ON revision (IdProgrammationJalon);
CREATE INDEX IF NOT EXISTS ix_histo_document ON doc_histo (IdDocument);
CREATE INDEX IF NOT EXISTS ix_histo_ligne ON doc_histo (GroupeLigne, IndiceLigne);
CREATE INDEX IF NOT EXISTS ix_import_raw_batch ON import_raw (BatchId);
CREATE INDEX IF NOT EXISTS ix_import_cmp_batch ON import_compare (BatchId);
CREATE INDEX IF NOT EXISTS ix_fa_envoi ON fiche_avis (IdEnvoi);
CREATE INDEX IF NOT EXISTS ix_fa_document ON fiche_avis (IdDocument);
CREATE INDEX IF NOT EXISTS ix_lookup_nom ON lookup_row (table_key, nom);
CREATE INDEX IF NOT EXISTS ix_document_fournisseur ON document (IdFournisseur);
CREATE INDEX IF NOT EXISTS ix_document_leader ON document (IdLeader);

CREATE TABLE IF NOT EXISTS import_fa_raw (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  BatchId INTEGER NOT NULL REFERENCES import_batch(Id) ON DELETE CASCADE,
  ligneEXCEL INTEGER,
  GroupeLigne INTEGER,
  IndiceLigne TEXT,
  Revision TEXT,
  Jalon TEXT,
  Version TEXT,
  EstPrevisionnel INTEGER NOT NULL DEFAULT 0,
  DatePrevisionnelle TEXT,
  ReponseFicheAvis TEXT,
  FichierFicheAvis TEXT,
  DateReceptionRATP TEXT,
  DatePrevReceptionFA TEXT,
  NumLotRATP TEXT,
  CommentairesRATP TEXT,
  CommentairesSup TEXT,
  RefuseAuChargement TEXT,
  NomUtilisateur TEXT,
  erreur TEXT,
  payload_json TEXT,
  IdDocument INTEGER,
  IdEnvoi INTEGER,
  IdRevision INTEGER
);
CREATE INDEX IF NOT EXISTS ix_import_fa_batch ON import_fa_raw (BatchId);
CREATE INDEX IF NOT EXISTS ix_import_fa_ligne ON import_fa_raw (GroupeLigne, IndiceLigne);
`;

export function extraColumns(): Array<{ table: string; name: string; ddl: string }> {
  return [
    { table: "import_batch", name: "AppliedDocuments", ddl: "AppliedDocuments INTEGER NOT NULL DEFAULT 0" },
    { table: "import_batch", name: "AppliedJalons", ddl: "AppliedJalons INTEGER NOT NULL DEFAULT 0" },
    { table: "import_batch", name: "AppliedFiches", ddl: "AppliedFiches INTEGER NOT NULL DEFAULT 0" },
    { table: "fiche_avis", name: "IdDocument", ddl: "IdDocument INTEGER" },
    { table: "fiche_avis", name: "IdRevision", ddl: "IdRevision INTEGER" },
    { table: "fiche_avis", name: "ReponseFicheAvis", ddl: "ReponseFicheAvis TEXT" },
    { table: "fiche_avis", name: "DateReceptionRATP", ddl: "DateReceptionRATP TEXT" },
    { table: "fiche_avis", name: "NumLotRATP", ddl: "NumLotRATP TEXT" },
    { table: "fiche_avis", name: "CommentairesRATP", ddl: "CommentairesRATP TEXT" },
    { table: "fiche_avis", name: "CommentairesSup", ddl: "CommentairesSup TEXT" },
    { table: "fiche_avis", name: "RefuseAuChargement", ddl: "RefuseAuChargement TEXT" },
    { table: "fiche_avis", name: "NomUtilisateur", ddl: "NomUtilisateur TEXT" },
    { table: "fiche_avis", name: "GroupeLigne", ddl: "GroupeLigne INTEGER" },
    { table: "fiche_avis", name: "IndiceLigne", ddl: "IndiceLigne TEXT" },
    { table: "fiche_avis", name: "Revision", ddl: "Revision TEXT" },
    { table: "fiche_avis", name: "Jalon", ddl: "Jalon TEXT" },
    { table: "fiche_avis", name: "Version", ddl: "Version TEXT" },
    { table: "fiche_avis", name: "FichierFicheAvis", ddl: "FichierFicheAvis TEXT" },
    { table: "revision", name: "IdDocument", ddl: "IdDocument INTEGER" },
    { table: "revision", name: "Commentaire", ddl: "Commentaire TEXT" },
    { table: "revision", name: "CreatedAt", ddl: "CreatedAt TEXT" },
  ];
}
