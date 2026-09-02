import fs from "node:fs";
import path from "node:path";
import {
  BX_TEMPLATE_FILE,
  DEFAULT_RAPIDE_FIXTURE,
  findFixturesDir,
  isOfficialTemplateName,
  OFFICIAL_TEMPLATES,
  PPD_TEMPLATE_FILE,
  PPD_TEMPLATE_SMALL_FILE,
} from "@mi20/domain";
import type { FileStorage } from "./storage.js";

export async function seedOfficialTemplates(storage: FileStorage): Promise<string[]> {
  const dir = findFixturesDir();
  const copied: string[] = [];
  for (const t of OFFICIAL_TEMPLATES) {
    const src = path.join(dir, t.file);
    if (!fs.existsSync(src)) continue;
    await storage.write(`templates/${t.file}`, fs.readFileSync(src));
    copied.push(t.file);
  }
  return copied;
}

export function readOfficialFixture(fileName: string): Buffer {
  if (!isOfficialTemplateName(fileName)) {
    throw new Error("Fichier template non autorisé");
  }
  const dir = findFixturesDir();
  const src = path.join(dir, fileName);
  if (!fs.existsSync(src)) throw new Error(`Fixture ${fileName} introuvable`);
  return fs.readFileSync(src);
}

export async function readTemplate(
  storage: FileStorage,
  fileName: string,
): Promise<Buffer> {
  const rel = `templates/${fileName}`;
  if (await storage.exists(rel)) return storage.read(rel);
  return readOfficialFixture(fileName);
}

export function listTemplates() {
  const dir = findFixturesDir();
  return OFFICIAL_TEMPLATES.map((t) => ({
    ...t,
    available: fs.existsSync(path.join(dir, t.file)),
  }));
}

export { BX_TEMPLATE_FILE, DEFAULT_RAPIDE_FIXTURE, PPD_TEMPLATE_FILE, PPD_TEMPLATE_SMALL_FILE };
