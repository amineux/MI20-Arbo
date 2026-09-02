# MI20 fixtures for amineux/MI20-Arbo

Official templates from `BASE ARBO MI20/SRV/TEMPLATE/` in the Arbo zip.

| File | Use |
|------|-----|
| PPD_Template.xlsx | Full PPD export/import template (~2.2MB) |
| Import_Rapide_exemple.xlsx | Small rapide import example |
| Import_Rapide_Jalons.xlsx | Jalons-only rapide import |
| MI20_BORD_TEMPLATE_M5_V12.xls | Current bordereau template |
| BX_Template.xls | Older BX template |
| KPI1_Template.xlsm | KPI export |
| BilanEnvois_Template.xlsx | Bilan envois |
| DoctsAutorisation_Template.xlsx | Docts autorisation |
| Copie de PPD_Template.xlsx | Smaller test copy from Test Sandra |
| MI20_BORD_CAF_0032.xlsm | Sample filled bordereau (may contain project refs) |

**Not included by default:** `EXPORT_PPD/PPD_MI20_*.xlsx` (~2.2MB each) — live CAF/RATP production exports. Ask if you need a sanitized subset of headers + few rows.

The API copies these files into `storage/templates/` at startup. Demo import uses `Import_Rapide_exemple.xlsx` by default (`POST /api/imports/ppd/demo`). PPD export fills `PPD_Template.xlsx`. Bordereau packs include `MI20_BORD_TEMPLATE_M5_V12.xls` (workbook protection: copied as binary, not parsed).

