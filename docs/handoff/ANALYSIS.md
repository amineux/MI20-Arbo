# MI20 / BASE ARBO — Analysis (Excel import path)

**Date:** 2026-09-02 (PT)  
**Source zip:** `/workspace/arbo/BASE_ARBO_MI20.zip` (760 583 061 bytes, Drive fileId `1tjhbGvHa9hoPfyiyiEo8GRJkQDgNoK2-`)  
**Selective extract:** `/workspace/arbo/extract/BASE ARBO MI20/` (~427 MB of DBs, configs, import samples, logs)  
**Inspect artifacts:** `/workspace/arbo/inspect/`

---

## 1. What the system does

**ARBO MI20** is a Bombardier/CAF–RATP **documentary production plan (PPD)** application built in **Microsoft Access** (split front-end / back-end):

| Role | File | Approx size / rows |
|------|------|--------------------|
| UI + VBA (`MI20_IHM.accdb`) | `client/IHM/MI20_IHM.accdb` | ~31 MB; forms + modules; version **IHM 1.6.6** |
| Data | `client/DATA/MI20_data.accdb` | ~226 MB; **~31 372** `document`, **~45 722** `programmation_jalon`, **~23 721** `revision`, **~30 716** `envoi`, **~195 787** `doc_histo` |
| Staging / import scratch | `client/IHM/MI20_temp_import.accdb` | `FILE_TEMP_IMPORT` in `config.ini` |
| Linked-table registry | `ListeTablesLiees` in IHM | Points IHM → data + temp import |

Paths and templates are driven by `client/IHM/config.ini` (and older `config.txt`):

- Templates: `PPD_Template.xlsx`, bordereau XLS, KPI xlsm, BilanEnvois, DoctsAutorisation  
- Exports: `EXPORT_PPD`, `EXPORT_BX`, `EXPORT_BILAN_ENVOIS`, `EXPORT_KPI`  
- Logs: `LOG_FILE`, `client/ERREURS`

**Business objects:** livrables / documents (`document` keyed by `GroupeLigne`+`IndiceLigne`), milestones (`jalon` / `programmation_jalon`), revisions, bordereaux/envois, RATP returns, fiche avis, lookup tables (`fournisseur`, `domaineChargeur`, `responsable`, `PIC`, …).

Main forms (from VBA strings): `Form_HOME`, `Form_EDIT_DOC`, `Form_CREATE_BX`, `Form_MGT_BX`, `Form_EXPORT`, `Form_import_compare`, `Form_import_nouveaux_docs`, `Form_SaisieRetoursRATP`, etc.

---

## 2. Current Excel import mechanism

### 2.1 Entry points (VBA)

Identified procedures / UI hooks:

- **`ImportPPD`** — full PPD import  
- **`ImportPPD_Rapide`**, **`ImportPPD_Jalons_Rapide`** — “fast” variants (narrower column set; `titrePremiereColonneXLS_PPD_rapide = Nr Livrable`)  
- **`ImportRetoursRATP`** — RATP return import  
- Bilan envois import (staging table `import_bilan_envois`)  
- UI: `ouvre_import_compare` / `ouvre_import_nouveaux_docs` (+ `_Click` on HOME)  
- Post-steps: `ComputeDifferences`, `InsertValidatedChanges`, `CreeJalonsImportes`, `AttachTables_Import`

Config section `[PPD]` defines header titles and jalon column ranges (e.g. jalons cols 44–66, dates 67–89, **`nbJalonsPPD = 23`**, `colFinPPD` / last-change column).

### 2.2 Pipeline (reconstructed)

```
Excel PPD (.xlsx)
    │  CreateObject("Excel.Application") + Workbooks.Open  (cell-by-cell / row loop)
    │  NOT DoCmd.TransferSpreadsheet for bulk load into staging
    ▼
MI20_temp_import.accdb
    ├── import_raw          (wide staging: ~161 cols incl. Jalon_Nom/Valeur/Date/EstPrevisionnel_1..24)
    ├── import_columns      (Excel header → field + nature: T / LDD / LDDDomaineChargeur / J / OUINON / …)
    ├── import_programmation_jalon
    ├── import_compare      (field-level old/new diffs for UI validation)
    ├── import_revisions / import_columns_revisions
    └── import_bilan_envois / import_columns_bilan_envois
    │
    │  per-row validation (lookup LDD*), DELETE/INSERT staging, FindFirst on document
    ▼
Form_import_compare / Form_import_nouveaux_docs  (user confirms)
    │  InsertValidatedChanges
    ▼
MI20_data.accdb  → document, programmation_jalon, revision, (+ histo)
    │
    ▼
erreur_import_PPD.txt / LOG_FILE  (row-level French messages)
```

**Column mapping** lives in table **`import_columns`** (temp DB), e.g.:

- `Num Liv.` → `GroupeLigne` (nature `LIGNE`)  
- `Fournisseur` → `IdFournisseur` (nature `LDD`, table `fournisseur`)  
- `Domaine chargeur` → `IdDomaineChargeur` (`LDDDomaineChargeur`)  
- `Jalon` → nature `J` → pivoted into `Jalon_*_1..24` then `programmation_jalon`

### 2.3 How Excel is read/written

- **Import:** automation via **`Excel.Application` / `Workbooks.Open`**, status bar updates per row (`SysCmd … "Etape … Ligne " & row_index`), DAO `OpenRecordset` / `Execute … dbFailOnError`, frequent **`FindFirst`** on `document` (`groupeligne` + `indiceligne`).  
- **`DoCmd.TransferSpreadsheet`** appears with **`acExport`** / `acSpreadsheetTypeExcel12Xml` (export path), **not** as the bulk import loader.  
- **Export PPD/KPI:** template copy + `CopyFromRecordset` into sheets (`DoExport`, `DoExportPPD`, `export_KPI1`, …).

Sample files named `client/import_PPD*.xlsx` are mostly **exports of `import_compare`** (diff review), not the source PPD. Real PPDs live under `EXPORT_PPD/` and `Test Sandra/` (often 15–34 MB, many columns / ~tens of thousands of lines). Error log shows Excel rows **~16 102–18 942** for one failed run.

### 2.4 Linked architecture

`ListeTablesLiees` attaches:

- All core data tables from `MI20_data.accdb`  
- All `import_*` tables from `MI20_temp_import.accdb`  

So the IHM talks to staging and production through linked tables after `AttachTables_Import` / `AttachTables_SRV`.

---

## 3. Bottlenecks (Excel import)

### B1 — Cell-by-cell Excel COM loop (dominant)
Opening a full PPD workbook and walking rows/columns in VBA with status updates is O(rows × cols). With ~16k–30k+ lines and ~100+ PPD columns (incl. 23 jalons × name/value/date), this dominates wall-clock time versus a bulk load.

### B2 — Per-row DAO / FindFirst against live `document`
Lookups like `FindFirst "groupeligne = … and nz(indiceligne)=…"` (and similar for jalons) on **31k+** documents are expensive if not always using the unique index `un_ligne_document (GroupeLigne, IndiceLigne)` efficiently, and they serialize the import.

### B3 — Lookup validation (`LDD*`) repeated per cell
Nature `LDD` / `LDDDomaineChargeur` resolves text → Id against `fournisseur`, `domaineChargeur`, `metier`, `responsable`, etc. Error file (`erreur_import_PPD.txt`, **467** messages) is almost entirely lookup failures:

- `metier` ~256  
- `fournisseur` ~198 (`OUEST INDUSTRIE` not in table)  
- `domaineChargeur` ~13  

Failures still cost full parse + write to `import_raw.erreur` before user review.

### B4 — Extremely wide `import_raw` (~161 columns)
24 jalon triplets denormalized on one row → huge DAO `AddNew`/`Update` payloads, poor page locality, hard to index meaningfully (only PK + `RefExt` + `IdTypeCode` on staging).

### B5 — Indexes / referential work left on during load
Production tables keep PKs and uniques active during insert/update (`un_ligne_document`, `un_prog (IdDocument,IdJalon)`, `DocumentIndice` on revision, etc.). No evidence of temporary index drop / `SetWarnings` bulk mode around the heavy insert phase (aside from generic `SetWarnings` string presence).

### B6 — `doc_histo` amplification
~196k history rows: if `Save_Histo_For(..., isImport:=True)` fires per field change, imports amplify I/O far beyond the PPD row count.

### B7 — Interactive compare step
`import_compare` can explode (sample export **~30 105** diff rows). User confirmation via `Form_import_compare` is necessary for safety but blocks “fire and forget” bulk apply; exporting compare to Excel then re-importing adds another round trip.

### B8 — Split DB + network paths
Design assumes `C:\BASE ARBO MI20\SRV\DATA\` vs local client. Linked Access over a slow share magnifies every recordset open/update during import.

### B9 — Access file bloat / backups in tree
Multiple `Sauvegarde*.accdb`, nested `MI20_IHM.zip`, and huge historical `EXPORT_PPD` workbooks inflate ops cost (not CPU of one import, but environment friction).

---

## 4. Evidence highlights

- Staging already exists and is the right place to optimize (`MI20_temp_import.accdb`).  
- Mapping is data-driven (`import_columns`) — good for maintainability.  
- Unique business key on documents: **`un_ligne_document (GroupeLigne, IndiceLigne)`**.  
- TransferSpreadsheet today = **export**, not import accelerator.  
- Failed imports often fail **referential/text match**, not structural Excel parse — pre-validation would save most “slow fail” runs.

---

## 5. Download / extract notes

- Anonymous `gdown` failed (file not public).  
- Downloaded via authenticated Chrome (Drive antivirus confirm “Télécharger quand même”) to `/workspace/arbo/BASE_ARBO_MI20.zip`.  
- Zip: **320** entries, ~1.67 GB uncompressed; selective extract avoided bulk `EXPORT_BX` document binaries.
