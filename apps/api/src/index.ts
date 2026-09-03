import "dotenv/config";
import { openDatabase } from "./db.js";
import { buildApp } from "./app.js";
import { seedIfEmpty } from "./seed.js";
import { createStorage } from "./storage.js";
import { seedOfficialTemplates } from "./templates.js";

const port = Number(process.env.PORT ?? 5080);
const host = process.env.HOST ?? "0.0.0.0";

const db = await openDatabase();
await seedIfEmpty(db);
const storage = createStorage();
await seedOfficialTemplates(storage);
const app = await buildApp({ db, storage });

try {
  await app.listen({ port, host });
  app.log.info(`MI20 Arbo API http://${host}:${port} (${db.dialect})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
