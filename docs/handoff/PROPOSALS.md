# MI20 / BASE ARBO — Proposals for faster Excel import

Prioritized, actionable. Object names are those found in `MI20_IHM.accdb`, `MI20_temp_import.accdb`, `MI20_data.accdb`, and `config.ini`.

---

## P0 — Highest impact on import wall-clock

### 1. Bulk-load Excel into staging (replace COM cell loop)
**Today:** `ImportPPD` / `ImportPPD_Rapide` open `Excel.Application` and iterate rows.  
**Change:**
1. `DoCmd.TransferSpreadsheet acImport, acSpreadsheetTypeExcel12Xml, "PPD_sheet_raw", path, True` **or** ACE/`SELECT * FROM [Excel 12.0 Xml;HDR=YES;IMEX=1].[PPD$]` into a flat staging table `import_ppd_sheet` (new) in `MI20_temp_import.accdb`.
2. Keep COM only to detect header row (`titrePremiereColonneXLS_PPD` / `_rapide` from `[PPD]` in `config.ini`) and sheet name.
3. Map columns with set-based SQL driven by existing **`import_columns`** → fill **`import_raw`**.

**Expected:** large speedup on 10k–30k-line PPDs (often 5–20× on the “read Excel” phase).  
**Touch:** VBA `ImportPPD`, `ImportPPD_Rapide`; new table `import_ppd_sheet`; optionally `AttachTables_Import`.

### 2. Pre-validate lookups in bulk (before row UI)
**Today:** per-cell `LDD` / `LDDDomaineChargeur` against `fournisseur`, `domaineChargeur`, `metier`, `responsable`, `PIC`, …  
**Change:**
1. Build temp dictionaries / joined queries once per import:
   - `CREATE TABLE import_lookup_cache (nature, texte, id)` or use queries joining sheet text to lookup tables (case-insensitive `UCase(Trim(...))`).
2. Left-join all rows; write failures to `import_raw.erreur` / `client/ERREURS/erreur_import_PPD.txt` in one pass.
3. Optionally auto-suggest “add missing fournisseur” from distinct failing values (error log shows many repeats of `OUEST INDUSTRIE`).

**Expected:** faster fail, fewer wasted full parses; cleaner `Form_import_nouveaux_docs` / compare.  
**Touch:** validation block inside `ImportPPD*`; tables `fournisseur`, `domaineChargeur`, `metier`, …

### 3. Set-based apply into `document` / `programmation_jalon`
**Today:** DAO `AddNew`/`Edit` + `FindFirst` per livrable; jalon updates piecemeal (`CreeJalonsImportes`).  
**Change:**
1. `DELETE * FROM import_compare` / rebuild compare via SQL joining `import_raw` to `document` on `(GroupeLigne, IndiceLigne)` (index **`un_ligne_document`**).
2. Batch:
   - `INSERT INTO document (…) SELECT … FROM import_raw WHERE NouveauDocument AND erreur Is Null`
   - `UPDATE document INNER JOIN import_raw …` for changed fields listed in `import_columns` where `AImporter=True`
3. Unpivot `Jalon_*_1..24` once into **`import_programmation_jalon`**, then merge to **`programmation_jalon`** using **`un_prog (IdDocument, IdJalon)`**.
4. Wrap in `DBEngine.BeginTrans` / `CommitTrans` (or `Workspace.BeginTrans`) with periodic commits every N thousand rows.

**Touch:** `InsertValidatedChanges`, `CreeJalonsImportes`, `ComputeDifferences`.

### 4. Disable non-essential indexes / histo during load
**Today:** all indexes live; `Save_Histo_For(..., isImport)` may flood **`doc_histo`** (~196k rows already).  
**Change:**
1. Flag `isImport` path: defer `Save_Histo_For` to a single bulk insert of histo rows after commit, or skip field-level histo for unchanged columns.
2. For huge first-loads only: temporarily drop non-PK indexes on `document` / `programmation_jalon` / `revision`, load, recreate (document carefully — keep `un_ligne_document` if used for merge keys, or merge via staging key then rebuild).
3. `DoCmd.SetWarnings False` already referenced — ensure it wraps the whole batch SQL section.

---

## P1 — Strong efficiency wins

### 5. Narrow “rapide” path as default for delta imports
**Objects:** `ImportPPD_Rapide`, `ImportPPD_Jalons_Rapide`, config `titrePremiereColonneXLS_PPD_rapide`.  
**Change:** Document and UI-default the rapide path when only jalons / revision / date resoumission change; full `ImportPPD` for structural/new lines. Align `import_columns.AImporter` flags with rapide vs full profiles (two profiles or a `ProfilImport` column).

### 6. Index staging for merge keys
**On `import_raw`:** add indexes on `(GroupeLigne, IndiceLigne)`, `ligneEXCEL`, `ImportUser`+`ImportTime` (purge helper).  
**On `import_compare`:** `(GroupeLigne, IndiceLigne)`, `isImported`.  
**On `import_programmation_jalon`:** `(IdDocument, IdJalon)` / `Code` (partially present).

### 7. Purge staging aggressively
VBA already has `DELETE * FROM import_raw|import_compare|import_revisions|import_bilan_envois`.  
**Change:** always purge at start **and** after successful `InsertValidatedChanges`; compact `MI20_temp_import.accdb` periodically (or recreate from template) — wide Memo columns bloat the file quickly.

### 8. Compare UI performance
**Forms:** `Form_import_compare`, `Form_import_nouveaux_docs`.  
**Change:** bind to a query filtering `isImported=False` with only needed columns; avoid loading 30k diffs into a continuous form at once; paginate; keep Excel export of compare (`client/import_PPD*.xlsx` pattern) as optional offline review.

### 9. TransferSpreadsheet / ACE for exports too
Exports already use `CopyFromRecordset` (good). Prefer stored queries returning only required columns for RATP mask (`[EXPORT_RATP] COLONNES_A_MASQUER`) to cut export time on 20–34 MB PPDs.

---

## P2 — Robustness & ops (indirect speed)

### 10. Normalize lookup data
Add missing suppliers/domains before re-import (from `erreur_import_PPD.txt`). Enforce trim/case rules consistently with import matching. Consider synonym table `fournisseur_alias (alias, IdFournisseur)`.

### 11. Keep data local during import
`config.ini` split `PATH_NET_DATA` vs `PATH_LOC_DATA`: run import against **local** `client/DATA/MI20_data.accdb`, then sync/replicate to SRV — or ensure SRV is SMB3/low-latency. Linked Access over WAN will erase other gains.

### 12. Schema cleanup
- Remove/archive `Feuil1`, stale `Table des erreurs` if unused in prod path.  
- Stop shipping multiple `Sauvegarde* de MI20_IHM.accdb` in the working client folder.  
- Compact & repair `MI20_data.accdb` after large imports.

### 13. Instrumentation
Log timestamps per stage already hinted in status strings (`Etape 1 - ouverture`, `Etape 2/3 - Ligne`, `Etape 4 - importe envois`, `ComputeDifferences`): write them to `LOG_FILE/import_ppd_timing_YYYYMMDD.txt` with row counts to measure P0 wins.

### 14. Longer-term (if Access remains the bottleneck)
- Upsize `MI20_data` to SQL Server / ACE linked SQL and keep Access as UI only; bulk `INSERT…SELECT` and proper covering indexes shine there.  
- Or external Python/ETL (openpyxl/pandas → ODBC bulk) using the same `import_columns` mapping — keep Access for validation UI only.

---

## Suggested implementation order

| Step | Action | Primary objects |
|------|--------|-----------------|
| 1 | ACE/TransferSpreadsheet → `import_ppd_sheet` → SQL fill `import_raw` | `ImportPPD`, `import_columns`, `MI20_temp_import` |
| 2 | Bulk lookup validation + better errors | `fournisseur`, `domaineChargeur`, `metier`, `erreur_import_PPD.txt` |
| 3 | SQL merge + transaction for document/jalons | `document`, `programmation_jalon`, `InsertValidatedChanges`, `CreeJalonsImportes` |
| 4 | Defer `doc_histo` / tighten indexes during load | `Save_Histo_For`, `doc_histo` |
| 5 | Staging indexes + purge/compact | `import_raw`, `import_compare` |
| 6 | Make Rapide the default delta path | `ImportPPD_Rapide`, `[PPD]` config |

---

## Quick reference — key object names

| Kind | Names |
|------|--------|
| Procedures | `ImportPPD`, `ImportPPD_Rapide`, `ImportPPD_Jalons_Rapide`, `ImportRetoursRATP`, `ComputeDifferences`, `InsertValidatedChanges`, `CreeJalonsImportes`, `AttachTables_Import`, `DoExportPPD` |
| Forms | `Form_HOME`, `Form_import_compare`, `Form_import_nouveaux_docs` |
| Staging tables | `import_raw`, `import_columns`, `import_compare`, `import_programmation_jalon`, `import_revisions`, `import_bilan_envois` |
| Data tables | `document`, `programmation_jalon`, `revision`, `envoi`, `bordereau`, `doc_histo`, lookups (`fournisseur`, `domaineChargeur`, …) |
| Indexes | `document.un_ligne_document`, `programmation_jalon.un_prog`, `revision.DocumentIndice` |
| Config | `config.ini` `[FILE] FILE_TEMP_IMPORT`, `[PPD] titrePremiere*`, `nbJalonsPPD`, `colPremierJalon*` |
