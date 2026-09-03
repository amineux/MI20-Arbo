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
import { EmptyState, PageHeader, useToast } from "../ui";

interface BatchInfo {
  batch: Record<string, unknown>;
  compare: Array<Record<string, unknown>>;
  nouveaux: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  raw: Array<Record<string, unknown>>;
}

interface ImportSummary {
  batchId: number;
  rowCount: number;
  errorCount: number;
  diffCount: number;
  newCount: number;
}

interface ApplyResult {
  appliedDocuments: number;
  appliedJalons: number;
  skippedErrors?: number;
  alreadyApplied?: boolean;
}

/** Prevents StrictMode double-fire of the guided tour autorun. */
let autorunInFlight = false;

function applyToastBody(r: ApplyResult): string {
  const skipped = r.skippedErrors ? ` · ${r.skippedErrors} ligne(s) LDD ignorée(s)` : "";
  return `${r.appliedDocuments} document(s) · ${r.appliedJalons} jalon(s)${skipped}.`;
}

export function ImportPpdPage() {
  const { batchId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [rapide, setRapide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<"compare" | "new" | "err">("compare");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [detail, setDetail] = useState<BatchInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [autorunHint, setAutorunHint] = useState(false);
  const skipReload = useRef(false);

  const load = (id: number) => {
    api
      .get<BatchInfo>(`/api/imports/${id}`)
      .then((d) => {
        setDetail(d);
        if (String(d.batch.Status) === "applied") {
          setApplied({
            appliedDocuments: Number(d.batch.appliedDocuments ?? 0),
            appliedJalons: Number(d.batch.appliedJalons ?? 0),
            alreadyApplied: true,
          });
        }
        if (d.nouveaux.length && !d.compare.length) setTab("new");
      })
      .catch((e: Error) => toast("error", "Import", e.message));
  };

  const applyBatch = async (id: number): Promise<ApplyResult> => {
    setApplying(true);
    try {
      const r = await api.post<ApplyResult>(`/api/imports/${id}/apply`);
      setApplied(r);
      setErrorMsg(null);
      toast(
        "success",
        r.alreadyApplied ? "Déjà appliqué" : "Modifications appliquées",
        applyToastBody(r),
      );
      load(id);
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

  const runDemo = async (file?: string, thenApply = false) => {
    setBusy(true);
    setErrorMsg(null);
    setApplied(null);
    try {
      const q = new URLSearchParams({ rapide: String(rapide || file === "Import_Rapide_Jalons.xlsx") });
      if (file) q.set("file", file);
      const r = await api.post<ImportSummary>(`/api/imports/ppd/demo?${q}`);
      setResult(r);
      toast("success", "PPD chargé", `${r.rowCount} lignes · ${r.diffCount} écarts · ${r.newCount} nouveaux · ${r.errorCount} erreur(s) LDD`);
      skipReload.current = true;
      nav(`/import-ppd/${r.batchId}`, { replace: true, state: null });
      const d = await api.get<BatchInfo>(`/api/imports/${r.batchId}`);
      setDetail(d);
      setTab(d.nouveaux.length ? "new" : "compare");
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
    if (batchId) load(Number(batchId));
  }, [batchId]);

  const appliedDone = Boolean(applied);
  const batchApplied = String(detail?.batch.Status ?? "") === "applied" || appliedDone;

  return (
    <div>
      <PageHeader title="Import PPD" form="ImportPPD / ImportPPD_Rapide / ImportPPD_Jalons_Rapide">
        Pipeline Access : Excel officiel (SheetJS) → import_raw → comparaison → application. Défaut :{" "}
        <b>Import_Rapide_exemple.xlsx</b> (Nr Livrable). Complet : PPD_Template (Num Liv.). Lignes en erreur LDD{" "}
        <code>UCase(Trim(Nom))</code> sont listées et ignorées à l&apos;application.
      </PageHeader>
      {autorunHint || (busy && !detail) ? (
        <MessageBar intent="info" style={{ marginTop: 12 }}>
          <MessageBarBody>
            <MessageBarTitle>Parcours démo</MessageBarTitle>
            Chargement de Import_Rapide_exemple.xlsx puis application des lignes validées…
            {busy ? <Spinner size="tiny" style={{ marginLeft: 8 }} /> : null}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0", flexWrap: "wrap" }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setErrorMsg(null);
            setApplied(null);
            const fd = new FormData();
            fd.append("file", file);
            fd.append("rapide", String(rapide));
            try {
              const r = await api.post<ImportSummary>(`/api/imports/ppd?rapide=${rapide}`, fd);
              setResult(r);
              toast("success", "Fichier importé", `${r.rowCount} lignes`);
              nav(`/import-ppd/${r.batchId}`);
              load(r.batchId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erreur import";
              setErrorMsg(msg);
              toast("error", "Import PPD", msg);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Checkbox checked={rapide} label="Import rapide (Nr Livrable)" onChange={(_, d) => setRapide(!!d.checked)} />
        <Button appearance="primary" disabled={busy} onClick={() => runDemo()}>
          Charger Import_Rapide_exemple.xlsx
        </Button>
        <Button disabled={busy} onClick={() => runDemo("Import_Rapide_Jalons.xlsx")}>
          Charger Import_Rapide_Jalons.xlsx
        </Button>
        <Button disabled={busy} onClick={() => { setRapide(false); void runDemo("PPD_Template.xlsx"); }}>
          Charger PPD_Template.xlsx (mode complet)
        </Button>
        {busy ? <Spinner size="tiny" /> : null}
      </div>
      {result ? (
        <MessageBar intent="success">
          <MessageBarBody>
            <MessageBarTitle>Lot {result.batchId} chargé</MessageBarTitle>
            {result.rowCount} lignes, {result.diffCount} écarts, {result.newCount} nouveaux, {result.errorCount}{" "}
            erreur(s) de lookup LDD. Vérifiez les onglets puis cliquez <b>Appliquer les modifications</b>.
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
          <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)} style={{ marginTop: 16 }}>
            <Tab value="compare">Comparaison ({detail.compare.length})</Tab>
            <Tab value="new">Nouveaux documents ({detail.nouveaux.length})</Tab>
            <Tab value="err">Erreurs LDD ({detail.errors.length})</Tab>
          </TabList>
          {tab === "compare" ? <DiffTable rows={detail.compare} /> : null}
          {tab === "new" ? <DiffTable rows={detail.nouveaux} /> : null}
          {tab === "err" ? <ErrorTable rows={detail.errors} /> : null}
          {detail.errors.length ? (
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
                ? "Ce lot est fusionné dans document + programmation_jalon (et doc_histo)."
                : "Étape Access InsertValidatedChanges : écrit les lignes sans erreur LDD. Un toast confirme les comptes."}
            </span>
          </div>
        </>
      ) : (
        <EmptyState
          title="Aucun lot chargé"
          detail="Parcours démo : Accueil → « Lancer l'import rapide », ou cliquez « Charger Import_Rapide_exemple.xlsx »."
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
          {rows.slice(0, 500).map((r) => (
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
