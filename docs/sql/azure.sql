-- Azure SQL / SQL Server migration of Access MI20_data (+ staging).
-- Demo uses SQLite (apps/api). Apply this script for production Azure SQL.
-- Synthetic demo data only — not a production dump.

IF OBJECT_ID('dbo.document', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RefExt NVARCHAR(80) NOT NULL CONSTRAINT DF_document_RefExt DEFAULT (''),
    GroupeLigne INT NOT NULL,
    IndiceLigne NVARCHAR(20) NOT NULL CONSTRAINT DF_document_Indice DEFAULT (''),
    IdLeader INT NULL,
    IdCoediteur INT NULL,
    IdCategorie INT NULL,
    IdCategorieAT INT NULL,
    IdDomaineBord INT NULL,
    IdFournisseur INT NULL,
    IdTypeDossier INT NULL,
    IdOrigine INT NULL,
    IdLogicielCAO INT NULL,
    IdModeleCAO INT NULL,
    QteEstimeeDocs NVARCHAR(50) NULL,
    Revision NVARCHAR(12) NOT NULL CONSTRAINT DF_document_Rev DEFAULT (''),
    EstConfidentiel BIT NOT NULL CONSTRAINT DF_document_Conf DEFAULT (0),
    RefExtParent NVARCHAR(MAX) NULL,
    IdResponsable INT NULL,
    Livrable NVARCHAR(MAX) NOT NULL CONSTRAINT DF_document_Liv DEFAULT (''),
    RefRATP NVARCHAR(MAX) NULL,
    EffMateriel NVARCHAR(MAX) NOT NULL CONSTRAINT DF_document_Eff DEFAULT (''),
    Poste NVARCHAR(MAX) NULL,
    IdDomaineChargeur INT NULL,
    IdMetier INT NULL,
    N_MF19 NVARCHAR(MAX) NULL,
    Nom NVARCHAR(MAX) NULL,
    Sections NVARCHAR(MAX) NULL,
    Categorie NVARCHAR(MAX) NULL,
    DocumentsConnexes NVARCHAR(MAX) NULL,
    CommentaireBT NVARCHAR(MAX) NULL,
    Titre NVARCHAR(MAX) NULL,
    Tranche NVARCHAR(MAX) NULL,
    SiteEmetteur NVARCHAR(MAX) NULL,
    NomsInformatiques NVARCHAR(MAX) NULL,
    RefPDMdocFNR NVARCHAR(255) NULL,
    RelecturePartenaire NVARCHAR(255) NULL,
    Affaire NVARCHAR(MAX) NULL,
    ApplicationMateriel NVARCHAR(MAX) NULL,
    DocReferentiel NVARCHAR(MAX) NULL,
    EstSecuritaire BIT NOT NULL CONSTRAINT DF_document_Sec DEFAULT (0),
    RFA BIT NOT NULL CONSTRAINT DF_document_RFA DEFAULT (0),
    DemandeSortieTemporaire BIT NOT NULL CONSTRAINT DF_document_DST DEFAULT (0),
    IDPic INT NULL,
    IDPerimetre INT NULL,
    DelivrableProjet BIT NOT NULL CONSTRAINT DF_document_Deliv DEFAULT (0),
    LignePPDCouverteParAutreNumero NVARCHAR(MAX) NULL,
    IdPicSupport INT NULL,
    IdProduit INT NULL,
    IdNiveauConfidentialite INT NULL,
    IdNiveauCommunication INT NULL,
    IdPourInfo_Acceptation INT NULL,
    RefDocumentSource NVARCHAR(MAX) NULL,
    IdPreuveAutorisation INT NULL,
    Homologuant BIT NOT NULL CONSTRAINT DF_document_Hom DEFAULT (0),
    IdTypeCode INT NULL,
    DateResoumission NVARCHAR(20) NULL,
    Langue NVARCHAR(5) NULL,
    Projet NVARCHAR(10) NULL,
    Metier NVARCHAR(50) NULL,
    IdTypeEnvoi INT NULL,
    Service NVARCHAR(255) NULL,
    FournitureNatif NVARCHAR(255) NULL,
    CONSTRAINT un_ligne_document UNIQUE (GroupeLigne, IndiceLigne)
  );
END
GO

IF OBJECT_ID('dbo.programmation_jalon', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.programmation_jalon (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdDocument INT NOT NULL,
    IdJalon INT NOT NULL,
    IdVersion INT NOT NULL CONSTRAINT DF_pj_ver DEFAULT (0),
    EstPrevisionnel BIT NOT NULL CONSTRAINT DF_pj_prev DEFAULT (0),
    DatePrevisionnelle DATETIME2 NULL,
    DemandeSortieTemporaire BIT NOT NULL CONSTRAINT DF_pj_dst DEFAULT (0),
    NbEnvoisNecessairesAvantAcceptation INT NULL,
    PourcAvancement INT NULL,
    Version NVARCHAR(80) NULL,
    Code NVARCHAR(40) NULL,
    Revision NVARCHAR(12) NULL,
    CONSTRAINT un_prog UNIQUE (IdDocument, IdJalon)
  );
END
GO

-- Remaining tables (lookup_row, bordereau, envoi, revision, import_*, doc_histo)
-- follow apps/api/src/schema.sql. Swap INTEGER→INT IDENTITY, TEXT→NVARCHAR, BOOLEAN→BIT.
