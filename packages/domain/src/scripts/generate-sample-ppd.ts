import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Official workbooks live in repo fixtures/. Do not generate invented PPD templates. */
const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "../../../../fixtures/README.md");
console.log("Use official fixtures under fixtures/. See", dest);
