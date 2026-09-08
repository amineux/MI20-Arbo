import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openMemoryDatabase } from "../src/db.js";
import { seed } from "../src/seed.js";
import { LocalFileStorage } from "../src/storage.js";
import { buildApp } from "../src/app.js";
import { seedOfficialTemplates } from "../src/templates.js";
import { BASE_LOCKED_MESSAGE } from "../src/lock.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mi20-lock-"));

async function harness() {
  const dir = tmp();
  const db = await openMemoryDatabase();
  await seed(db, { extraDocs: 0 });
  const storage = new LocalFileStorage(path.join(dir, "storage"));
  await seedOfficialTemplates(storage);
  const app = await buildApp({ db, storage });
  return { dir, db, storage, app };
}

describe("API app_lock blocks writes", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("stores the lock and returns 409 on mutating routes until unlock", async () => {
    const h = await harness();
    dirs.push(h.dir);

    const locked = await h.app.inject({
      method: "POST",
      url: "/api/lock",
      payload: { locked: true, message: "Base verrouillée pour maintenance." },
    });
    expect(locked.statusCode).toBe(200);
    expect(locked.json()).toMatchObject({ locked: 1, message: "Base verrouillée pour maintenance." });

    const lookupWrite = await h.app.inject({
      method: "POST",
      url: "/api/lookups/fournisseur",
      payload: { nom: "NOUVEAU FOURNISSEUR" },
    });
    expect(lookupWrite.statusCode).toBe(409);
    expect(lookupWrite.json()).toMatchObject({
      error: "Base verrouillée pour maintenance.",
      message: "Base verrouillée pour maintenance.",
    });
    const stillMissing = await h.db.get<{ id: number }>(
      "SELECT id FROM lookup_row WHERE table_key = ? AND nom = ?",
      ["fournisseur", "NOUVEAU FOURNISSEUR"],
    );
    expect(stillMissing).toBeUndefined();

    const docs = await h.app.inject({ method: "GET", url: "/api/documents?pageSize=10" });
    expect(docs.statusCode).toBe(200);
    const firstId = docs.json().rows[0].Id as number;

    const docWrite = await h.app.inject({
      method: "PUT",
      url: `/api/documents/${firstId}`,
      payload: { Titre: "TITRE BLOQUE" },
    });
    expect(docWrite.statusCode).toBe(409);

    const apply = await h.app.inject({ method: "POST", url: "/api/imports/1/apply" });
    expect(apply.statusCode).toBe(409);

    const bx = await h.app.inject({
      method: "POST",
      url: "/api/bordereaux",
      payload: { idLeader: 1 },
    });
    expect(bx.statusCode).toBe(409);

    const rev = await h.app.inject({
      method: "POST",
      url: "/api/revisions",
      payload: { idDocument: firstId, revision: "Z" },
    });
    expect(rev.statusCode).toBe(409);

    const getLock = await h.app.inject({ method: "GET", url: "/api/lock" });
    expect(getLock.statusCode).toBe(200);
    expect(getLock.json().locked).toBe(1);

    const lookups = await h.app.inject({ method: "GET", url: "/api/lookups" });
    expect(lookups.statusCode).toBe(200);

    const exportPpd = await h.app.inject({ method: "POST", url: "/api/exports/ppd", payload: {} });
    expect(exportPpd.statusCode).toBe(200);

    const unlock = await h.app.inject({
      method: "POST",
      url: "/api/lock",
      payload: { locked: false, message: null },
    });
    expect(unlock.statusCode).toBe(200);
    expect(unlock.json().locked).toBe(0);

    const added = await h.app.inject({
      method: "POST",
      url: "/api/lookups/fournisseur",
      payload: { nom: "NOUVEAU FOURNISSEUR" },
    });
    expect(added.statusCode).toBe(200);
    expect(added.json()).toMatchObject({ nom: "NOUVEAU FOURNISSEUR" });

    await h.app.close();
    await h.db.close();
  });

  it("uses the French default message when lock.message is empty", async () => {
    const h = await harness();
    dirs.push(h.dir);

    const locked = await h.app.inject({
      method: "POST",
      url: "/api/lock",
      payload: { locked: true, message: null },
    });
    expect(locked.statusCode).toBe(200);

    const blocked = await h.app.inject({
      method: "POST",
      url: "/api/lookups/fournisseur",
      payload: { nom: "AUTRE FOURNISSEUR" },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({
      error: BASE_LOCKED_MESSAGE,
      message: BASE_LOCKED_MESSAGE,
    });

    await h.app.close();
    await h.db.close();
  });
});
