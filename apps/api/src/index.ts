import "dotenv/config";
import { dbPathFromEnv, openDatabase } from "./db.js";
import { buildApp } from "./app.js";
import { seedIfEmpty } from "./seed.js";
import { createStorage } from "./storage.js";

const port = Number(process.env.PORT ?? 5080);
const host = process.env.HOST ?? "0.0.0.0";

const db = openDatabase(dbPathFromEnv());
seedIfEmpty(db);
const storage = createStorage();
const app = await buildApp({ db, storage });

try {
  await app.listen({ port, host });
  app.log.info(`MI20 Arbo API http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
