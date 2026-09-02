# Access form → MI20 Arbo screen

Source: `docs/handoff/TEKKY_BASE_ARBO_HANDOFF.md`. Do not add modules that are not listed there.

| Access form / proc | Web route | Status |
|--------------------|-----------|--------|
| Form_HOME | `/` | MVP |
| Form_EDIT_DOC | `/documents/:id` | MVP |
| Form_FILTRES_RECHERCHE | `/documents` (search + filters) | MVP |
| Form_import_compare | `/import-ppd/:batchId` tab Comparaison | MVP |
| Form_import_nouveaux_docs | `/import-ppd/:batchId` tab Nouveaux | MVP |
| ImportPPD / ImportPPD_Rapide / ImportPPD_Jalons_Rapide | `/import-ppd` (flag rapide) | MVP (jalons inclus dans le parse 44–89) |
| DoExportPPD / Form_EXPORT (PPD) | `/export-ppd` | MVP |
| Form_CREATE_BX / Form_MGT_BX | `/bordereaux`, `/bordereaux/:id` | MVP |
| Lookups (fournisseur, domaineChargeur, metier, PIC, …) | `/lookups` | MVP |
| Form_CREATE_REV | `/revisions` | Stub |
| Form_SaisieRetoursRATP / fiche avis | `/retours-ratp` | Stub |
| export_KPI1 / ExportBilanEnvois / DoctsAutorisation | `/kpi` | Stub |
| Form_REPORT / doc_histo | `/rapports` | Stub (histo déjà écrit à l'import/édition) |
| Form_VerrouillageBase | `/verrouillage` + bannière globale | Route + bannière (toggle démo) |
| Form_ARCHI | — | Not in MVP (handoff list only; no dedicated screen) |
| AttachTables_* / config.ini | API `app_config` + `.env` | Config, not a screen |

## Business keys (do not change)

- Document: **GroupeLigne + IndiceLigne** (`un_ligne_document`)
- Jalon programmé: **IdDocument + IdJalon** (`un_prog`)
- Lookup match: **UCase(Trim(Nom))**
- PPD LIGNE example: `36 / 9351.3`
- BX pack: `EXPORT_BX/MI20_BORD_<code>/`
- BX template name: `MI20_BORD_TEMPLATE_M5_V12.xls`
- RATP mask: columns **C, AA, AB, AC**
