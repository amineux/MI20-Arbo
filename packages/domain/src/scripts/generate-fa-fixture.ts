import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFaImportAoa, writeAoaWorkbook } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "../../../../fixtures/Import_Retours_RATP_exemple.xlsx");
const buf = writeAoaWorkbook(
  buildFaImportAoa([
    {
      numLivrable: "36 / 9351.3",
      revision: "B",
      jalon: "JD1",
      version: "AV",
      reponseFicheAvis: "VA",
      fichierFicheAvis: "FA_36_9351.3_VA.pdf",
      dateReceptionRATP: "2026-09-01",
      numLotRATP: "LOT-DEMO-1",
      commentairesRATP: "Retour RATP de démonstration (données synthétiques)",
      nomUtilisateur: "demo.user",
    },
    {
      numLivrable: "36 / 476",
      revision: "A",
      jalon: "JD1",
      version: "FD",
      reponseFicheAvis: "FA",
      fichierFicheAvis: "FA_36_476.pdf",
      commentairesRATP: "Fiche avis synthétique sur second livrable",
    },
    {
      numLivrable: "99 / 404",
      revision: "A",
      reponseFicheAvis: "VR",
      commentairesRATP: "Ligne volontairement inconnue pour tester les erreurs",
    },
  ]),
  "FA",
);
writeFileSync(dest, buf);
console.log("Wrote", dest, buf.length, "bytes");
