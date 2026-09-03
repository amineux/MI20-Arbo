import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_RAPIDE_FIXTURE } from "./fixtures-names.js";

export {
  DEFAULT_RAPIDE_FIXTURE,
  JALONS_RAPIDE_FIXTURE,
  PPD_TEMPLATE_FILE,
  PPD_TEMPLATE_SMALL_FILE,
  BX_TEMPLATE_FILE,
  BX_TEMPLATE_LEGACY_FILE,
  BX_SAMPLE_FILE,
  FA_RAPIDE_FIXTURE,
  OFFICIAL_TEMPLATES,
  isOfficialTemplateName,
} from "./fixtures-names.js";
export type { OfficialTemplate } from "./fixtures-names.js";

export function findFixturesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();
  const candidates = [
    join(cwd, "fixtures"),
    join(cwd, "../fixtures"),
    join(cwd, "../../fixtures"),
    join(cwd, "../../../fixtures"),
    join(here, "../../../fixtures"),
    join(here, "../../../../fixtures"),
    join(here, "../../../../../fixtures"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, DEFAULT_RAPIDE_FIXTURE))) return dir;
  }
  throw new Error("Répertoire fixtures/ introuvable (Import_Rapide_exemple.xlsx manquant).");
}

export function fixturePath(fileName: string): string {
  const base = findFixturesDir();
  const target = join(base, fileName);
  if (!existsSync(target)) {
    throw new Error(`Fixture officielle introuvable: ${fileName}`);
  }
  return target;
}
