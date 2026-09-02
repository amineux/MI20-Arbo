PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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
