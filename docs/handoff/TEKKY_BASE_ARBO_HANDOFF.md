# Base Arbo MI20 — Handoff for SharePoint / M365 rebuild

**Source of truth on New Bot's computer:**
- Zip: `/workspace/arbo/BASE_ARBO_MI20.zip` (~726 MB, Drive fileId `1tjhbGvHa9hoPfyiyiEo8GRJkQDgNoK2-`, owner dupojack7@gmail.com)
- Selective extract: `/workspace/arbo/extract/BASE ARBO MI20/`
- Inspect dumps: `/workspace/arbo/inspect/` (schemas, import_columns.csv, config, VBA string fragments)
- Analysis: `/workspace/arbo/ANALYSIS.md`, `/workspace/arbo/PROPOSALS.md`
- Bulk import package already emailed to user: `/workspace/arbo/delivery/MI20_ImportPPD_Bulk_v1.zip`

**Product:** Bombardier/CAF–RATP documentary production plan (PPD) + bordereau (BX) management. Access split app IHM **1.6.6**.

---

## 1. Folder tree (deployed layout on Windows)

```
C:\BASE ARBO MI20\
├── SRV\                          # network/shared (config PATH_NETWORK)
│   ├── DATA\MI20_DATA.accdb      # production data (linked)
│   ├── IHM\
│   ├── SYSTEM\PICTURE\
│   └── TEMPLATE\
│       ├── PPD_Template.xlsx
│       ├── MI20_BORD_TEMPLATE_M5_V12.xls
│       ├── KPI1_Template.xlsm
│       ├── BilanEnvois_Template.xlsx
│       └── DoctsAutorisation_Template.xlsx
├── client\
│   ├── IHM\
│   │   ├── MI20_IHM.accdb        # UI + VBA
│   │   ├── MI20_temp_import.accdb
│   │   ├── config.ini
│   │   └── requetes.accdb
│   ├── DATA\MI20_data.accdb      # local data copy (PATH_LOC_DATA)
│   ├── ERREURS\erreur_import_PPD.txt
│   ├── TEMPLATE\
│   └── import_PPD*.xlsx          # exports of import_compare (diff review), not source PPDs
├── EXPORT_PPD\                   # PPD Excel exports (often 15–34 MB)
├── EXPORT_BX\MI20_BORD_* \       # one folder per bordereau + attached PDFs
├── EXPORT_BILAN_ENVOIS\
├── EXPORT_KPI\
├── LOG_FILE\
└── (PDFs) BOMBARDIER-ARBO_MI20-BL-V1.0.pdf, PVA acceptation PDF
```

Extract on box mirrors this under `/workspace/arbo/extract/BASE ARBO MI20/` (SRV templates may be missing from selective extract; client/IHM/DATA present).

---

## 2. Architecture

| Role | File | Notes |
|------|------|-------|
| UI + VBA | `MI20_IHM.accdb` | Forms + modules; version IHM 1.6.6 |
| Data | `MI20_data.accdb` | ~31 372 documents, ~45 722 programmation_jalon, ~23 721 revision, ~30 716 envoi, ~3 891 bordereau, ~196 k doc_histo |
| Staging | `MI20_temp_import.accdb` | import_* tables |
| Linked tables | `ListeTablesLiees` | IHM → data + temp |

Config: `client/IHM/config.ini` (also older `config.txt`). Key sections `[BASE]` paths, `[FILE]` names, `[PPD]` column layout, `[TEMPLATE]`, `[EXPORT_RATP] COLONNES_A_MASQUER=C,AA,AB,AC`.

---

## 3. Core data model (implement these entities)

### document (business key: GroupeLigne + IndiceLigne; unique index `un_ligne_document`)
Id, RefExt, GroupeLigne, IndiceLigne, Revision, Livrable, Titre, Nom, Sections, Poste, …
FKs: IdLeader, IdCoediteur, IdCategorie, IdCategorieAT, IdDomaineBord, IdFournisseur, IdTypeDossier, IdOrigine, IdLogicielCAO, IdModeleCAO, IdResponsable, IdDomaineChargeur, IdMetier, IDPic, IDPerimetre, IdPicSupport, IdProduit, IdNiveauConfidentialite, IdNiveauCommunication, IdPourInfo_Acceptation, IdPreuveAutorisation, IdTypeCode, IdTypeEnvoi
Flags: EstConfidentiel, EstSecuritaire, DelivrableProjet, Homologuant, RFA, …
Also: DateResoumission, Langue, Projet, Metier, RefExtParent, RefDocumentSource, RefPDMdocFNR, CommentaireBT, Tranche, SiteEmetteur, N_MF19, EffMateriel, LignePPDCouverteParAutreNumero, …

### programmation_jalon (unique `un_prog` IdDocument+IdJalon)
Id, IdDocument, IdJalon, IdVersion, EstPrevisionnel, DatePrevisionnelle, Version, Code, Revision

### revision
Id, Revision, IdProgrammationJalon, NomUtilisateur, EstActive, FichierFicheAvis_*, IdTypeDocument, flagEnCoursImport, IdType_mise_a_jour

### bordereau / envoi / ficheAvis
Bordereau ~3891 rows; envoi ~30716 — shipping packs of documents to RATP with attached files under EXPORT_BX\MI20_BORD_*\.

### Lookups (display field typically Nom)
fournisseur, domaineChargeur (Id, Nom, IdPerimetre, IdDomaine, IdMetier), domaine, metier, leader, PIC, Responsable, categorie, categorieAT, Perimetre, dossier, PourInfo_Acceptation, NiveauConfidentialite, NiveauCommunication, PreuveAutorisation, modele_cao, logiciel_cao, TypeCode, Type_Envoi, jalon, version, type_document, origine, produit, …

### History
doc_histo — field-level change history (~196k); Save_Histo_For(db, key, property, Optional isImport)

Full DDL samples: `/workspace/arbo/inspect/data_schema.txt`, `temp_schema.txt`, `data_indexes.txt`.

---

## 4. Screens (Access forms → map to web modules)

| Form | Module meaning |
|------|----------------|
| Form_HOME | Hub / navigation |
| Form_EDIT_DOC | Edit livrable/document |
| Form_CREATE_BX / Form_MGT_BX | Create / manage bordereau |
| Form_CREATE_REV | Create revision |
| Form_EXPORT | Exports (PPD, BX, KPI, bilan) |
| Form_import_compare | Review field-level PPD diffs before apply |
| Form_import_nouveaux_docs | Review new documents from import |
| Form_SaisieRetoursRATP | RATP return capture |
| Form_FILTRES_RECHERCHE | Search/filters |
| Form_REPORT | Reports |
| Form_ARCHI | Architecture view |
| Form_VerrouillageBase | DB lock |

---

## 5. PPD workflow (critical)

### Import pipeline
1. Excel PPD (.xlsx) — headers include `Num Liv.` (full) or `Nr Livrable` (rapide)
2. VBA `ImportPPD` / `ImportPPD_Rapide` / `ImportPPD_Jalons_Rapide` (today: Excel.Application cell loops)
3. Staging `import_raw` (wide, ~161 cols incl. Jalon_*_1..24) driven by **`import_columns`** mapping
4. User UI: Form_import_compare / Form_import_nouveaux_docs
5. `ComputeDifferences` → `InsertValidatedChanges` → `CreeJalonsImportes`
6. Merge into `document` + `programmation_jalon` (+ histo)

### import_columns natures
- `T` / `TITRE` — text
- `LIGNE` — parse into GroupeLigne + IndiceLigne (e.g. 36 / 9351.3)
- `LDD` — lookup by Nom → Id (table_associee)
- `LDDDomaineChargeur` — domain-scoped lookup
- `OUINON` — boolean
- `J` — jalon pivot into Jalon_Nom/Valeur/Date/EstPrevisionnel_1..24
- `AUTORISANT` — Homologuant

CSV mapping: `/workspace/arbo/inspect/import_columns.csv` (54 rows).

### [PPD] config (current config.ini)
- titrePremiereColonneXLS_PPD = Num Liv.
- titrePremiereColonneXLS_PPD_rapide = Nr Livrable
- titreDerniereColonneXLS_PPD = Date de la prochaine soumission
- colPremierJalon=44 … colDernierJalon=66
- colPremierJalonDate=67 … colDernierJalonDate=89
- nbJalonsPPD=23, colFinPPD=161, colonneDateDernierChangement=162

### Export PPD
`DoExportPPD` / templates; TransferSpreadsheet/CopyFromRecordset; RATP mask columns C,AA,AB,AC; files under EXPORT_PPD\PPD_MI20_*.xlsx

---

## 6. Bordereau (BX) workflow

- Forms: CREATE_BX, MGT_BX
- Template: MI20_BORD_TEMPLATE_M5_V12.xls
- Output: EXPORT_BX\MI20_BORD_<supplier>_<num>\ with PDF attachments
- Linked tables: bordereau, envoi, ficheAvis, revision
- Related: ImportRetoursRATP, bilan envois import (`import_bilan_envois`), KPI exports

---

## 7. Other important modules to mirror

1. **Document master** (search, edit, filters) — Form_EDIT_DOC + FILTRES_RECHERCHE  
2. **PPD import/export** — full + rapide + jalons-only  
3. **Bordereau lifecycle** — create, attach docs, export pack, track envois  
4. **RATP returns / fiche avis** — Form_SaisieRetoursRATP, FA files on revision  
5. **Jalons / revisions programming** — programmation_jalon + revision  
6. **KPI / bilan envois / docts autorisation** exports  
7. **History / audit** — doc_histo  
8. **Lookups admin** — fournisseurs, domaines chargeur, métiers, PIC, etc.  
9. **Config / attach tables** — AttachTables_Import, AttachTables_SRV, config.ini paths  
10. **Locking** — Form_VerrouillageBase  

---

## 8. Suggested SharePoint / Dataverse mapping

| Access | M365 |
|--------|------|
| MI20_data tables | Dataverse / SharePoint lists / SQL Azure |
| document + FKs | Document list + lookup columns |
| programmation_jalon | child list Document→Jalon |
| bordereau + envoi | lists + document library for PDFs |
| EXPORT_BX folders | SharePoint library `EXPORT_BX/{BordereauCode}/` |
| PPD Excel | Power Automate / script import into staging lists, or Power Apps |
| Forms | Power Apps canvas / model-driven |
| VBA ImportPPD | Power Automate + Office Scripts / Azure Function bulk load |

Business key for documents: **GroupeLigne + IndiceLigne**.  
Lookup match rule: **UCase(Trim(Nom))**.

---

## 9. What we already shipped to the user

Email to dupojack7@gmail.com: `MI20_ImportPPD_Bulk_v1.zip` — VBA bulk TransferSpreadsheet path for faster Excel import (does not replace whole app).

---

## 10. Gaps / caveats for implementers

- Full VBA source not fully decompiled; behavior reconstructed from strings + schemas + staging samples.
- Selective extract skipped most EXPORT_BX PDF bulk and some SRV template binaries — templates referenced in config.ini paths.
- `ListeTablesLiees` dump shows older `C:\MI20\...` paths; live config.ini uses `C:\BASE ARBO MI20\...`.
- Do not invent extra modules: stick to forms/tables listed above.
