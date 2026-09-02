import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { buildSamplePpdAoa } from "../../test/sample-ppd.js";

const here = dirname(fileURLToPath(import.meta.url));
const dests = [
  join(here, "../../../../apps/api/test/fixtures/ppd_sample.xlsx"),
  join(here, "../../../../docs/fixtures/ppd_sample.xlsx"),
];
const aoa = buildSamplePpdAoa();
const ws = XLSX.utils.aoa_to_sheet(aoa);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "PPD");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
for (const dest of dests) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  console.log("Wrote", dest, buf.length, "bytes");
}
