export type { ColumnNature, ImportColumn, PpdConfig, LookupRow, LookupCatalog, JalonSlot, StagedDocument, CompareRow, DocumentSnapshot, JalonDef } from "./types.js";
export { DEFAULT_PPD_CONFIG, RAPIDE_FIELD_ALLOWLIST, JALON_SLOT_COUNT } from "./types.js";
export { parseLigne, formatLigne, cellToText } from "./ligne.js";
export { normalizeLookupName, matchLookupByNom, matchLookupDomaineChargeur, lookupTableKey } from "./lookup.js";
export { parseOuiNon, formatOuiNon } from "./oui-non.js";
export { parseImportColumnsCsv, normalizeHeader, indexColumnsByHeader, canonicalHeader } from "./columns.js";
export { loadBundledImportColumns } from "./columns-fs.js";
export { unpivotJalons, matchJalonDef, jalonsToRawFields, cellToDateIso, jalonCodeFromHeader } from "./jalon.js";
export { parsePpdSheet, detectHeaderRow } from "./parse-workbook.js";
export { computeDifferences, docKey } from "./compare.js";
export { parseWorkbookToAoa, buildPpdExportWorkbook, excelColumnLetter, fillOfficialPpdTemplate, writeAoaWorkbook } from "./xlsx-io.js";
export {
  parseFaSheet,
  detectFaHeaderRow,
  buildFaImportAoa,
  FA_FIRST_COLUMN_TITLES,
  FA_EXPORT_HEADERS,
} from "./parse-fa.js";
export type { StagedFicheAvis, ParseFaResult, FaWorkbookRow } from "./parse-fa.js";
export {
  findFixturesDir,
  fixturePath,
  isOfficialTemplateName,
  OFFICIAL_TEMPLATES,
  DEFAULT_RAPIDE_FIXTURE,
  JALONS_RAPIDE_FIXTURE,
  PPD_TEMPLATE_FILE,
  PPD_TEMPLATE_SMALL_FILE,
  BX_TEMPLATE_FILE,
  BX_SAMPLE_FILE,
  FA_RAPIDE_FIXTURE,
} from "./fixtures.js";
