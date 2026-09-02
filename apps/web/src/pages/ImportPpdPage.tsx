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
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

interface BatchInfo {
  batch: Record<string, unknown>;
  compare: Array<Record<string, unknown>>;
  nouveaux: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  raw: Array<Record<string, unknown>>;
}

export function ImportPpdPage() {
  const { batchId } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const [rapide, setRapide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"compare" | "new" | "err">("compare");
  const [result, setResult] = useState<{
    batchId: number;
    rowCount: number;
    errorCount: number;
    diffCount: number;
    newCount: number;
  } | null>(null);
  const [detail, setDetail] = useState<BatchInfo | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const load = (id: number) => {
    api.get<BatchInfo>(`/api/imports/${id}`).then(setDetail).catch((e: Error) => toast("error", "Import", e.message));
  };

  const runDemo = async (file?: string) => {
    setBusy(true);
    setApplyMsg(null);
    try {
      const q = new URLSearchParams({ rapide: String(rapide || file === "Import_Rapide_Jalons.xlsx") });
      if (file) q.set("file", file);
      const r = await api.post<{
        batchId: number;
        rowCount: number;
        errorCount: number;
        diffCount: number;
        newCount: number;
      }>(`/api/imports/ppd/demo?${q}`);
      setResult(r);
      toast("success", "PPD chargé", `${r.rowCount} lignes · ${r.diffCount} écarts · ${r.errorCount} erreur(s) LDD`);
      nav(`/import-ppd/${r.batchId}`);
      load(r.batchId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur import";
      setApplyMsg(msg);
      toast("error", "Import PPD", msg);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (batchId) load(Number(batchId));
  }, [batchId]);

  return (
    <div>
      <PageHeader title="Import PPD" form="ImportPPD / ImportPPD_Rapide / ImportPPD_Jalons_Rapide">
        Pipeline Access : Excel officiel (SheetJS) → import_raw → comparaison → application. Défaut :{" "}
        <b>Import_Rapide_exemple.xlsx</b> (Nr Livrable). Complet : PPD_Template (Num Liv.). Lignes en erreur LDD{" "}
        <code>UCase(Trim(Nom))</code> sont listées et ignorées à l&apos;application.
      </PageHeader>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0", flexWrap: "wrap" }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setApplyMsg(null);
            const fd = new FormData();
            fd.append("file", file);
            fd.append("rapide", String(rapide));
            try {
              const r = await api.post<{
                batchId: number;
                rowCount: number;
                errorCount: number;
                diffCount: number;
                newCount: number;
              }>(`/api/imports/ppd?rapide=${rapide}`, fd);
              setResult(r);
              toast("success", "Fichier importé", `${r.rowCount} lignes`);
              nav(`/import-ppd/${r.batchId}`);
              load(r.batchId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erreur import";
              setApplyMsg(msg);
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
        {busy ? <Spinner size="tiny" /> : null}
      </div>
      {result ? (
        <MessageBar intent="success">
          <MessageBarBody>
            <MessageBarTitle>Lot {result.batchId}</MessageBarTitle>
            {result.rowCount} lignes, {result.diffCount} écarts, {result.newCount} nouveaux, {result.errorCount}{" "}
            erreur(s) de lookup LDD.
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {applyMsg ? (
        <MessageBar intent="error">
          <MessageBarBody>{applyMsg}</MessageBarBody>
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
          <Button
            appearance="primary"
            style={{ marginTop: 16 }}
            onClick={async () => {
              const id = Number(batchId ?? result?.batchId);
              try {
                const r = await api.post<{ appliedDocuments: number; appliedJalons: number }>(
                  `/api/imports/${id}/apply`,
                );
                const msg = `Application : ${r.appliedDocuments} document(s), ${r.appliedJalons} jalon(s). Lignes en erreur ignorées.`;
                setApplyMsg(msg);
                toast("success", "Import appliqué", msg);
              } catch (e) {
                toast("error", "Application", e instanceof Error ? e.message : "échec");
              }
            }}
          >
            Appliquer les modifications validées (sans erreur)
          </Button>
        </>
      ) : (
        <Body1 style={{ marginTop: 8 }}>Cliquez « Charger Import_Rapide_exemple.xlsx » pour le parcours démo.</Body1>
      )}
    </div>
  );
}

function DiffTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <Body1 style={{ marginTop: 12 }}>Aucun écart sur cet onglet.</Body1>;
  }
  return (
    <Table size="small">
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
  );
}

function ErrorTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <Body1 style={{ marginTop: 12 }}>Aucune erreur LDD sur ce lot.</Body1>;
  }
  return (
    <Table size="small">
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
  );
}
