import {
  Body1,
  Button,
  Checkbox,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title3,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

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
  const [rapide, setRapide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"compare" | "new" | "err">("compare");
  const [result, setResult] = useState<{ batchId: number; rowCount: number; errorCount: number; diffCount: number; newCount: number } | null>(
    null,
  );
  const [detail, setDetail] = useState<BatchInfo | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const load = (id: number) => {
    api.get<BatchInfo>(`/api/imports/${id}`).then(setDetail);
  };

  useEffect(() => {
    if (batchId) load(Number(batchId));
  }, [batchId]);

  return (
    <div>
      <Title3>Import PPD</Title3>
      <Body1>
        Pipeline Access ImportPPD : Excel (SheetJS, pas COM) → import_raw → Form_import_compare / Form_import_nouveaux_docs
        → application document + programmation_jalon. Première colonne : Num Liv. (complet) ou Nr Livrable (rapide).
      </Body1>
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
              nav(`/import-ppd/${r.batchId}`);
              load(r.batchId);
            } catch (err) {
              setApplyMsg(err instanceof Error ? err.message : "Erreur import");
            } finally {
              setBusy(false);
            }
          }}
        />
        <Checkbox checked={rapide} label="Import rapide (Nr Livrable)" onChange={(_, d) => setRapide(!!d.checked)} />
        {busy ? <Spinner size="tiny" /> : null}
      </div>
      {result ? (
        <MessageBar intent="success">
          <MessageBarBody>
            Lot {result.batchId} — {result.rowCount} lignes, {result.diffCount} écarts, {result.newCount} nouveaux,{" "}
            {result.errorCount} erreur(s) de lookup.
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {applyMsg ? <Body1>{applyMsg}</Body1> : null}
      {detail ? (
        <>
          <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)} style={{ marginTop: 16 }}>
            <Tab value="compare">Comparaison ({detail.compare.length})</Tab>
            <Tab value="new">Nouveaux documents ({detail.nouveaux.length})</Tab>
            <Tab value="err">Erreurs ({detail.errors.length})</Tab>
          </TabList>
          {tab === "compare" ? <DiffTable rows={detail.compare} /> : null}
          {tab === "new" ? <DiffTable rows={detail.nouveaux} /> : null}
          {tab === "err" ? <ErrorTable rows={detail.errors} /> : null}
          <Button
            appearance="primary"
            style={{ marginTop: 16 }}
            onClick={async () => {
              const id = Number(batchId ?? result?.batchId);
              const r = await api.post<{ appliedDocuments: number; appliedJalons: number }>(`/api/imports/${id}/apply`);
              setApplyMsg(`Application : ${r.appliedDocuments} document(s), ${r.appliedJalons} jalon(s). Lignes en erreur ignorées.`);
            }}
          >
            Appliquer les modifications validées (sans erreur)
          </Button>
        </>
      ) : null}
    </div>
  );
}

function DiffTable({ rows }: { rows: Array<Record<string, unknown>> }) {
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
