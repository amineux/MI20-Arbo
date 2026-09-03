import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildFaImportAoa, writeAoaWorkbook } from "@mi20/domain/browser";
import { DemoHttpError, handleDemoApi } from "./handlers";
import { getState, resetState } from "./store";

function asFile(data: Buffer | Uint8Array, name: string): File {
  const src = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bytes = new Uint8Array(src.byteLength);
  bytes.set(src);
  return new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await handleDemoApi(new URL(`http://demo.local${path}`), init);
  } catch (err) {
    if (err instanceof DemoHttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }
}

async function json<T>(res: Response): Promise<T> {
  expect(res.ok, await res.clone().text()).toBe(true);
  return (await res.json()) as T;
}

beforeEach(() => {
  (window as unknown as { __mi20OrigFetch?: typeof fetch }).__mi20OrigFetch = async () =>
    new Response("missing", { status: 404 });
  resetState();
});

afterEach(() => {
  resetState();
});

describe("demo handlers — PPD upload + apply", () => {
  it("parses a real Excel upload (rapide before file) and persists documents", async () => {
    const aoa = [
      ["Nr Livrable", "Titre du document", "Indice de révision", "Référence externe (Titulaire)"],
      ["36 / 9351.3", "AXE CROCHET MIS A JOUR", "B", "CAF-ECH-007"],
      ["99 / 1", "NOUVEAU LIVRABLE TEST", "A", "TEST-NEW"],
    ];
    const file = asFile(writeAoaWorkbook(aoa, "PPD"), "import-test.xlsx");
    const fd = new FormData();
    fd.append("rapide", "true");
    fd.append("file", file);

    const staged = await json<{
      batchId: number;
      rowCount: number;
      newCount: number;
      diffCount: number;
    }>(await call("/api/imports/ppd?rapide=true", { method: "POST", body: fd }));

    expect(staged.rowCount).toBe(2);
    expect(staged.newCount).toBeGreaterThanOrEqual(1);
    expect(staged.diffCount).toBeGreaterThan(0);

    const applied = await json<{ appliedDocuments: number; alreadyApplied?: boolean }>(
      await call(`/api/imports/${staged.batchId}/apply`, { method: "POST" }),
    );
    expect(applied.alreadyApplied).not.toBe(true);
    expect(applied.appliedDocuments).toBeGreaterThan(0);

    const docs = await json<{ rows: Array<{ GroupeLigne: number; IndiceLigne: string; Titre: string; Revision: string }> }>(
      await call("/api/documents?search=99&pageSize=50"),
    );
    expect(docs.rows.some((d) => d.GroupeLigne === 99 && d.IndiceLigne === "1")).toBe(true);

    const updated = getState().documents.find(
      (d) => Number(d.GroupeLigne) === 36 && String(d.IndiceLigne) === "9351.3",
    );
    expect(updated?.Titre).toBe("AXE CROCHET MIS A JOUR");
    expect(updated?.Revision).toBe("B");
  });
});

describe("demo handlers — bordereau ZIP", () => {
  it("creates a CAF header, attaches a livrable, and downloads EXPORT_BX zip", async () => {
    const leaders = await json<{ rows: Array<{ id: number; nom: string }> }>(await call("/api/lookups/Leader"));
    const caf = leaders.rows.find((r) => r.nom === "CAF");
    expect(caf).toBeTruthy();

    const created = await json<{ id: number; nomComplet: string }>(
      await call("/api/bordereaux", {
        method: "POST",
        body: JSON.stringify({ idLeader: caf!.id }),
      }),
    );
    expect(created.nomComplet).toMatch(/^MI20_BORD_CAF_/);

    const docs = await json<{ rows: Array<{ Id: number }> }>(await call("/api/documents?search=36&pageSize=10"));
    expect(docs.rows[0]).toBeTruthy();

    const attach = await call(`/api/bordereaux/${created.id}/documents`, {
      method: "POST",
      body: JSON.stringify({ documentIds: [docs.rows[0]!.Id] }),
    });
    expect(attach.ok).toBe(true);

    const exported = await json<{ folder: string; files: string[] }>(
      await call(`/api/bordereaux/${created.id}/export`, { method: "POST" }),
    );
    expect(exported.folder).toContain("EXPORT_BX");
    expect(exported.files.length).toBeGreaterThan(0);

    const zip = await call(`/api/bordereaux/${created.id}/download`);
    expect(zip.ok).toBe(true);
    expect(zip.headers.get("content-type")).toBe("application/zip");
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(32);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

describe("demo handlers — FA import", () => {
  it("imports an Excel FA and applies updates to envois / révisions", async () => {
    const aoa = buildFaImportAoa([
      {
        numLivrable: "36 / 9351.3",
        revision: "C",
        reponseFicheAvis: "VA",
        fichierFicheAvis: "FA_TEST.pdf",
        commentairesRATP: "Avis favorable",
      },
    ]);
    const file = asFile(writeAoaWorkbook(aoa, "FA"), "fa-test.xlsx");
    const fd = new FormData();
    fd.append("file", file);

    const staged = await json<{ batchId: number; rowCount: number; matchedCount: number; errorCount: number }>(
      await call("/api/imports/fa", { method: "POST", body: fd }),
    );
    expect(staged.rowCount).toBe(1);
    expect(staged.matchedCount).toBe(1);
    expect(staged.errorCount).toBe(0);

    const applied = await json<{
      appliedFiches: number;
      updatedEnvois: number;
      updatedRevisions: number;
    }>(await call(`/api/imports/${staged.batchId}/apply`, { method: "POST" }));
    expect(applied.appliedFiches).toBe(1);
    expect(applied.updatedRevisions).toBeGreaterThan(0);
    expect(applied.updatedEnvois).toBeGreaterThan(0);

    const doc = getState().documents.find((d) => Number(d.GroupeLigne) === 36 && String(d.IndiceLigne) === "9351.3");
    expect(doc?.Revision).toBe("C");
    const fa = getState().ratpReturns.find((r) => r.IdDocument === doc?.Id && r.FichierFicheAvis === "FA_TEST.pdf");
    expect(fa).toBeTruthy();
    expect(fa?.ReponseFicheAvis).toBe("VA");
  });
});

describe("demo handlers — lock + lookups", () => {
  it("blocks writes while locked and still allows unlock", async () => {
    const locked = await json<{ locked: number }>(
      await call("/api/lock", { method: "POST", body: JSON.stringify({ locked: true, message: "test lock" }) }),
    );
    expect(locked.locked).toBe(1);

    const blocked = await call("/api/lookups/fournisseur", {
      method: "POST",
      body: JSON.stringify({ nom: "NOUVEAU FOURNISSEUR" }),
    });
    expect(blocked.status).toBe(409);

    await call("/api/lock", { method: "POST", body: JSON.stringify({ locked: false, message: null }) });
    const added = await call("/api/lookups/fournisseur", {
      method: "POST",
      body: JSON.stringify({ nom: "NOUVEAU FOURNISSEUR" }),
    });
    expect(added.ok).toBe(true);
  });

  it("rejects case-insensitive duplicate lookup names", async () => {
    const dup = await call("/api/lookups/fournisseur", {
      method: "POST",
      body: JSON.stringify({ nom: " caf " }),
    });
    expect(dup.status).toBe(409);
  });

  it("persists a document edit", async () => {
    const list = await json<{ rows: Array<{ Id: number; Titre: string }> }>(await call("/api/documents?pageSize=10"));
    const doc = list.rows[0]!;
    const saved = await json<{ Titre: string }>(
      await call(`/api/documents/${doc.Id}`, {
        method: "PUT",
        body: JSON.stringify({ Titre: "TITRE EDITE" }),
      }),
    );
    expect(saved.Titre).toBe("TITRE EDITE");
    const again = getState().documents.find((d) => d.Id === doc.Id);
    expect(again?.Titre).toBe("TITRE EDITE");
  });

  it("seeds the key 36 / 9351.3", async () => {
    const stats = await json<{ documents: number }>(await call("/api/stats"));
    expect(stats.documents).toBeGreaterThanOrEqual(12);
    const docs = await json<{ rows: Array<{ GroupeLigne: number; IndiceLigne: string }> }>(
      await call("/api/documents?search=9351.3"),
    );
    expect(docs.rows.some((d) => d.GroupeLigne === 36 && d.IndiceLigne === "9351.3")).toBe(true);
  });
});
