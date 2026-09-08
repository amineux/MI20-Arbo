import {
  Body1,
  Button,
  Checkbox,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { isStaticDemo } from "../demo/install";
import { DEMO_LARGE_FILE_MESSAGE, DEMO_MAX_UPLOAD_BYTES } from "../demo/limits";
import { EmptyState, PageHeader, useToast } from "../ui";

interface BatchInfo {
  batch: Record<string, unknown>;
  compare: Array<Record<string, unknown>>;
  nouveaux: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  raw: Array<Record<string, unknown>>;
  totals?: { compare: number; nouveaux: number; errors: number; raw: number };
  page?: number;
  pageSize?: number;
}

interface ImportSummary {
  batchId: number;
  rowCount: number;
  errorCount: number;
  diffCount: number;
  newCount: number;
  warnings?: string[];
}

interface ApplyResult {
  appliedDocuments: number;
  appliedJalons: number;
  skippedErrors?: number;
  alreadyApplied?: boolean;
}

type ImportTab = "compare" | "new" | "err";

const PAGE_SIZE = 200;

/** Prevents StrictMode double-fire of the guided tour autorun. */
let autorunInFlight = false;

function applyToastBody(r: ApplyResult): string {
  const skipped = r.skippedErrors ? ` · ${r.skippedErrors} ligne(s) LDD ignorée(s)` : "";
  return `${r.appliedDocuments} document(s) · ${r.appliedJalons} jalon(s)${skipped}.`;
}

function apiTab(tab: ImportTab): string {
  if (tab === "new") return "new";
  if (tab === "err") return "err";
  return "compare";
}

export function ImportPpdPage() {
  const { batchId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [rapide, setRapide] = useState(true);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<ImportTab>("compare");
  const [listPage, setListPage] = useState(1);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [detail, setDetail] = useState<BatchInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [autorunHint, setAutorunHint] = useState(false);
  const skipReload = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedBatchId = useRef<number | null>(null);
  const staticDemo = isStaticDemo();

  const load = (id: number, tabName: ImportTab = tab, page = listPage) => {
    const q = new URLSearchParams({
      tab: apiTab(tabName),
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    return api
      .get<BatchInfo>(`/api/imports/${id}?${q}`)
      .then((d) => {
        setDetail(d);
        if (String(d.batch.Status) === "applied") {
          setApplied({
            appliedDocuments: Number(d.batch.appliedDocuments ?? d.batch.AppliedDocuments ?? 0),
            appliedJalons: Number(d.batch.appliedJalons ?? d.batch.AppliedJalons ?? 0),
            alreadyApplied: true,
          });
          appliedBatchId.current = Number(d.batch.Id);
        }
        return d;
      })
      .catch((e: Error) => {
        toast("error", "Import", e.message);
        return null;
      });
  };

  const applyBatch = async (id: number): Promise<ApplyResult> => {
    setApplying(true);
    try {
      const r = await api.post<ApplyResult>(`/api/imports/${id}/apply`);
      setApplied(r);
      appliedBatchId.current = id;
      setErrorMsg(null);
      toast(
        "success",
        r.alreadyApplied ? "Déjà appliqué" : "Modifications appliquées",
        applyToastBody(r),
      );
      await load(id);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "échec";
      setErrorMsg(msg);
      toast("error", "Application", msg);
      throw e;
    } finally {
      setApplying(false);
    }
  };

  const showStaged = async (r: ImportSummary) => {
    setResult(r);
    const warn = r.warnings?.filter(Boolean) ?? [];
    if (r.rowCount === 0) {
      toast("warning", "PPD sans lignes de données", warn[0] || "Le classeur n'a pas de livrables sous Num Liv. / Nr Livrable.");
    } else {
      toast(
        "success",
        "PPD chargé",
        `${r.rowCount} lignes · ${r.diffCount} écarts · ${r.newCount} nouveaux · ${r.errorCount} erreur(s) LDD`,
      );
    }
    skipReload.current = true;
    nav(`/import-ppd/${r.batchId}`, { replace: true, state: null });
    const nextTab: ImportTab = r.newCount && !r.diffCount ? "new" : r.errorCount && !r.diffCount ? "err" : "compare";
    setTab(nextTab);
    setListPage(1);
    await load(r.batchId, nextTab, 1);
  };

  const runDemo = async (file?: string, thenApply = false) => {
    setBusy(true);
    setErrorMsg(null);
    setApplied(null);
    appliedBatchId.current = null;
    setDetail(null);
    try {
      const isFullTemplate = file === "PPD_Template.xlsx";
      const q = new URLSearchParams({
        rapide: String(isFullTemplate ? false : rapide || file === "Import_Rapide_Jalons.xlsx"),
      });
      if (file) q.set("file", file);
      const r = await api.post<ImportSummary>(`/api/imports/ppd/demo?${q}`);
      await showStaged(r);
      if (thenApply) {
        await applyBatch(r.batchId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur import";
      setErrorMsg(msg);
      toast("error", "Import PPD", msg);
    } finally {
      setBusy(false);
      setAutorunHint(false);
    }
  };

  const uploadWorkbook = async (file: File) => {
    setSelectedFileName(file.name);
    if (staticDemo && file.size > DEMO_MAX_UPLOAD_BYTES) {
      setErrorMsg(DEMO_LARGE_FILE_MESSAGE);
      toast("warning", "Démo Pages", "Fichier trop volumineux pour le navigateur.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setApplied(null);
    appliedBatchId.current = null;
    setDetail(null);
    const fd = new FormData();
    // Field before file so proxies/parsers never wait on a trailing part.
    fd.append("rapide", String(rapide));
    fd.append("file", file);
    try {
      const r = await api.post<ImportSummary>(`/api/imports/ppd?rapide=${rapide}`, fd);
      await showStaged(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur import";
      setErrorMsg(msg);
      toast("error", "Import PPD", msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const autorun = (location.state as { autorun?: string } | null)?.autorun;
    if (autorun !== "rapide-apply") return;
    if (autorunInFlight) return;
    autorunInFlight = true;
    setAutorunHint(true);
    nav(location.pathname, { replace: true, state: null });
    void runDemo(undefined, true).finally(() => {
      autorunInFlight = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guided tour, once per navigation
  }, [location.state]);

  useEffect(() => {
    if (skipReload.current) {
      skipReload.current = false;
      return;
    }
    if (batchId) void load(Number(batchId), tab, listPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tab/page drive pagination of the same lot
  }, [batchId, tab, listPage]);

  const currentBatchId = Number(batchId ?? result?.batchId ?? detail?.batch.Id ?? 0);
  const detailId = Number(detail?.batch.Id ?? 0);
  const thisBatchViewed = detailId > 0 && currentBatchId > 0 && detailId === currentBatchId;
  const batchApplied =
    thisBatchViewed &&
    (String(detail?.batch.Status ?? "") === "applied" || appliedBatchId.current === currentBatchId);

  const totals = detail?.totals;
  const compareCount = totals?.compare ?? detail?.compare.length ?? 0;
  const newCount = totals?.nouveaux ?? detail?.nouveaux.length ?? 0;
  const errCount = totals?.errors ?? detail?.errors.length ?? 0;
  const tabTotal = tab === "compare" ? compareCount : tab === "new" ? newCount : errCount;
  const pageSize = detail?.pageSize ?? PAGE_SIZE;
  const maxPage = Math.max(1, Math.ceil(tabTotal / pageSize));

  return (
    <div>
      <PageHeader title="Import PPD">
        Importez un classeur Excel, comparez, puis appliquez. Rapide = colonne <b>Nr Livrable</b> · Complet ={" "}
        <b>Num Liv.</b> Les erreurs de référentiel (nom unique, insensible à la casse) sont listées et ignorées à
        l&apos;application. La comparaison est paginée (lots Access ~30 000 écarts).
      </PageHeader>
      {staticDemo ? (
        <MessageBar intent="warning" style={{ marginTop: 12 }}>
          <MessageBarBody>
            <MessageBarTitle>Démo GitHub Pages</MessageBarTitle>
            Cette page analyse Excel dans le navigateur et n&apos;accepte que de petits classeurs. Un PPD Access
            (~31 000 documents, 15–34 Mo) doit être importé dans l&apos;application complète :{" "}
            <b>npm run dev</b> (http://127.0.0.1:5173) ou <b>docker compose</b> — l&apos;API parse côté serveur, pagine
            la comparaison et applique sans geler le navigateur.
          </MessageBarBody>
        </MessageBar>
      ) : (
        <MessageBar intent="info" style={{ marginTop: 12 }}>
          <MessageBarBody>
            <MessageBarTitle>Import côté serveur</MessageBarTitle>
            Le classeur est envoyé à <code>/api</code> (limite 80 Mo). La comparaison ne charge pas tout le lot dans le
            navigateur — utilisez les pages ou « Exporter la comparaison ».
          </MessageBarBody>
        </MessageBar>
      )}
      {autorunHint || (busy && !detail) ? (
        <MessageBar intent="info" style={{ marginTop: 12 }}>
          <MessageBarBody>
            <MessageBarTitle>Import en cours</MessageBarTitle>
            {staticDemo
              ? "Analyse du classeur dans le navigateur…"
              : "Envoi du classeur à l'API, staging, puis préparation de la comparaison…"}
            {busy ? <Spinner size="tiny" style={{ marginLeft: 8 }} /> : null}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      <div className="mi20-import-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void uploadWorkbook(file);
          }}
        />
        <div className="mi20-import-primary">
          <Button
            appearance="primary"
            size="large"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Choisir un fichier Excel…
          </Button>
          <Checkbox
            checked={rapide}
            label="Import rapide (Nr Livrable)"
            onChange={(_, d) => setRapide(!!d.checked)}
          />
          {busy ? <Spinner size="tiny" /> : null}
        </div>
        {selectedFileName ? (
          <Body1 className="mi20-file-chip">Fichier sélectionné : <b>{selectedFileName}</b></Body1>
        ) : (
          <Body1 className="mi20-file-hint">Formats acceptés : .xlsx / .xls — le dialogue système s’ouvre au clic.</Body1>
        )}
        <details className="mi20-demo-details">
          <summary>Exemples de démo (fixtures)</summary>
          <div className="mi20-demo-row">
            <Button disabled={busy} onClick={() => runDemo()}>
              Import_Rapide_exemple.xlsx
            </Button>
            <Button disabled={busy} onClick={() => runDemo("Import_Rapide_Jalons.xlsx")}>
              Import_Rapide_Jalons.xlsx
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setRapide(false);
                void runDemo("PPD_Template.xlsx");
              }}
            >
              PPD_Template.xlsx (complet)
            </Button>
          </div>
        </details>
      </div>
      {result ? (
        <MessageBar intent={result.rowCount === 0 ? "warning" : "success"}>
          <MessageBarBody>
            <MessageBarTitle>Lot {result.batchId} chargé</MessageBarTitle>
            {result.rowCount} lignes, {result.diffCount} écarts, {result.newCount} nouveaux, {result.errorCount}{" "}
            erreur(s) de lookup LDD.
            {result.rowCount === 0
              ? " Aucune ligne à appliquer — utilisez un classeur rempli (pas le calque vide)."
              : " Vérifiez les onglets puis cliquez Appliquer les modifications validées."}
            {result.warnings?.length ? (
              <div style={{ marginTop: 6 }}>{result.warnings.filter(Boolean).join(" ")}</div>
            ) : null}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {applied ? (
        <MessageBar intent="success" style={{ marginTop: 8 }}>
          <MessageBarBody>
            <MessageBarTitle>
              {applied.alreadyApplied ? "Lot déjà appliqué" : "Application confirmée"}
            </MessageBarTitle>
            {applyToastBody(applied)} Les documents sont visibles dans la liste (clé GroupeLigne + IndiceLigne).
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {errorMsg ? (
        <MessageBar intent="error" style={{ marginTop: 8 }}>
          <MessageBarBody>{errorMsg}</MessageBarBody>
        </MessageBar>
      ) : null}
      {detail ? (
        <>
          <TabList
            selectedValue={tab}
            onTabSelect={(_, d) => {
              setTab(d.value as ImportTab);
              setListPage(1);
            }}
            style={{ marginTop: 16 }}
          >
            <Tab value="compare">Comparaison ({compareCount})</Tab>
            <Tab value="new">Nouveaux documents ({newCount})</Tab>
            <Tab value="err">Erreurs LDD ({errCount})</Tab>
          </TabList>
          {tab === "compare" ? <DiffTable rows={detail.compare} /> : null}
          {tab === "new" ? <DiffTable rows={detail.nouveaux} /> : null}
          {tab === "err" ? <ErrorTable rows={detail.errors} /> : null}
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button disabled={listPage <= 1} onClick={() => setListPage((p) => p - 1)}>
              Précédent
            </Button>
            <Body1>
              Page {listPage} / {maxPage} — {tabTotal} ligne(s)
            </Body1>
            <Button disabled={listPage >= maxPage} onClick={() => setListPage((p) => p + 1)}>
              Suivant
            </Button>
            <Button
              onClick={async () => {
                try {
                  await api.download(`/api/imports/${currentBatchId}/compare.xlsx`, `import_PPD_compare_${currentBatchId}.xlsx`);
                  toast("success", "Comparaison exportée", "Classeur Excel (comme import_PPD*.xlsx Access).");
                } catch (e) {
                  toast("error", "Export comparaison", e instanceof Error ? e.message : "échec");
                }
              }}
            >
              Exporter la comparaison (.xlsx)
            </Button>
          </div>
          {errCount ? (
            <Body1 style={{ marginTop: 8 }}>
              Les lignes en erreur (lookup fournisseur / LDD) ne seront pas appliquées — comme InsertValidatedChanges.
            </Body1>
          ) : null}
          <div className="mi20-apply-bar">
            <Button
              appearance="primary"
              size="large"
              disabled={applying || batchApplied}
              onClick={() => {
                const id = Number(batchId ?? result?.batchId);
                if (!id) return;
                void applyBatch(id);
              }}
            >
              {applying ? <Spinner size="tiny" /> : null}
              {batchApplied ? "Modifications déjà appliquées" : "Appliquer les modifications validées"}
            </Button>
            <span className="hint">
              {batchApplied
                ? "Ce lot est fusionné dans les documents, jalons programmés et l'historique."
                : "Seules les lignes sans erreur de référentiel sont écrites. Un toast confirme les comptes."}
            </span>
          </div>
        </>
      ) : (
        <EmptyState
          title="Choisissez un fichier Excel"
          detail="Cliquez sur « Choisir un fichier Excel… » pour ouvrir le sélecteur (.xlsx / .xls), ou utilisez un exemple de démo ci-dessus."
        />
      )}
    </div>
  );
}

function DiffTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <EmptyState title="Aucun écart" detail="Rien à comparer sur cet onglet." />;
  }
  return (
    <div className="mi20-table-wrap">
      <Table size="extra-small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Ligne</TableHeaderCell>
            <TableHeaderCell>Champ</TableHeaderCell>
            <TableHeaderCell>Ancien</TableHeaderCell>
            <TableHeaderCell>Nouveau</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={String(r.Id)}>
              <TableCell>
                {String(r.GroupeLigne)} / {String(r.IndiceLigne)}
              </TableCell>
              <TableCell>{String(r.fieldLabel)}</TableCell>
              <TableCell>{String(r.oldValue ?? "")}</TableCell>
              <TableCell>{String(r.newValue ?? "")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ErrorTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <EmptyState title="Aucune erreur LDD" detail="Toutes les lignes de ce lot ont un lookup fournisseur / LDD valide." />;
  }
  return (
    <div className="mi20-table-wrap">
      <Table size="extra-small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Excel</TableHeaderCell>
            <TableHeaderCell>Ligne</TableHeaderCell>
            <TableHeaderCell>Erreur</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={String(r.Id)}>
              <TableCell>{String(r.ligneEXCEL)}</TableCell>
              <TableCell>
                {String(r.GroupeLigne)} / {String(r.IndiceLigne)}
              </TableCell>
              <TableCell>{String(r.erreur)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
