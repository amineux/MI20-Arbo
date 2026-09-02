export const DEFAULT_RAPIDE_FIXTURE = "Import_Rapide_exemple.xlsx";
export const JALONS_RAPIDE_FIXTURE = "Import_Rapide_Jalons.xlsx";
export const PPD_TEMPLATE_FILE = "PPD_Template.xlsx";
export const PPD_TEMPLATE_SMALL_FILE = "Copie_de_PPD_Template.xlsx";
export const BX_TEMPLATE_FILE = "MI20_BORD_TEMPLATE_M5_V12.xls";
export const BX_TEMPLATE_LEGACY_FILE = "BX_Template.xls";
export const BX_SAMPLE_FILE = "MI20_BORD_CAF_0032.xlsm";

export interface OfficialTemplate {
  file: string;
  role: string;
  labelFr: string;
}

/** Official files under repo `fixtures/` — do not invent replacements. */
export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  { file: PPD_TEMPLATE_FILE, role: "ppd-export", labelFr: "Template PPD complet" },
  { file: DEFAULT_RAPIDE_FIXTURE, role: "ppd-import-rapide", labelFr: "Exemple import rapide" },
  { file: JALONS_RAPIDE_FIXTURE, role: "ppd-import-jalons", labelFr: "Import rapide jalons" },
  { file: PPD_TEMPLATE_SMALL_FILE, role: "ppd-export-small", labelFr: "Copie template PPD (test)" },
  { file: BX_TEMPLATE_FILE, role: "bx", labelFr: "Template bordereau M5 V12" },
  { file: BX_TEMPLATE_LEGACY_FILE, role: "bx-legacy", labelFr: "Ancien template BX" },
  { file: "KPI1_Template.xlsm", role: "kpi", labelFr: "Template KPI1" },
  { file: "BilanEnvois_Template.xlsx", role: "bilan", labelFr: "Template bilan envois" },
  { file: "DoctsAutorisation_Template.xlsx", role: "docts", labelFr: "Template documents d'autorisation" },
  { file: BX_SAMPLE_FILE, role: "bx-sample", labelFr: "Exemple bordereau CAF 0032" },
];

export function isOfficialTemplateName(fileName: string): boolean {
  return OFFICIAL_TEMPLATES.some((t) => t.file === fileName);
}
