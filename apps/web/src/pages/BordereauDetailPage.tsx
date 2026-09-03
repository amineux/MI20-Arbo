import {
  Body1,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Loading, PageHeader, useToast } from "../ui";

export function BordereauDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [data, setData] = useState<{
    bordereau: Record<string, unknown>;
    envois: Array<Record<string, unknown>>;
    template: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () =>
    api
      .get<{ bordereau: Record<string, unknown>; envois: Array<Record<string, unknown>>; template: string }>(
        `/api/bordereaux/${id}`,
      )
      .then(setData)
      .catch((e: Error) => toast("error", "Bordereau", e.message));

  useEffect(() => {
    reload();
  }, [id]);

  if (!data) return <Loading label="Chargement du bordereau…" />;

  return (
    <div>
      <Link to="/bordereaux">
        <Button>← Liste</Button>
      </Link>
      <PageHeader title={String(data.bordereau.NomComplet)}>
        Joindre des documents puis exporter le pack EXPORT_BX ({data.template}).
      </PageHeader>
      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <Input
          style={{ minWidth: 240, flex: 1 }}
          placeholder="Rechercher un document à rattacher"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
        />
        <Button
          onClick={async () => {
            const r = await api.get<{ rows: Array<Record<string, unknown>> }>(
              `/api/documents?search=${encodeURIComponent(search)}&pageSize=20`,
            );
            setDocs(r.rows);
            if (!r.rows.length) toast("info", "Aucun document", "Essayez 36 ou AXE");
          }}
        >
          Chercher
        </Button>
      </div>
      {docs.length ? (
        <div className="mi20-table-wrap">
        <Table size="extra-small">
          <TableBody>
            {docs.map((d) => (
              <TableRow key={String(d.Id)}>
                <TableCell>
                  {String(d.GroupeLigne)} / {String(d.IndiceLigne)} — {String(d.Titre)}
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={async () => {
                      await api.post(`/api/bordereaux/${id}/documents`, { documentIds: [d.Id] });
                      setMsg("Document rattaché.");
                      toast("success", "Document rattaché");
                      reload();
                    }}
                  >
                    Rattacher
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      ) : null}
      <Body1 style={{ marginTop: 16, fontWeight: 600 }}>Envois</Body1>
      <div className="mi20-table-wrap">
      <Table size="extra-small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Ligne</TableHeaderCell>
            <TableHeaderCell>Réf.</TableHeaderCell>
            <TableHeaderCell>Titre</TableHeaderCell>
            <TableHeaderCell>Indice</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.envois.map((e) => (
            <TableRow key={String(e.Id)}>
              <TableCell>
                {String(e.GroupeLigne)} / {String(e.IndiceLigne)}
              </TableCell>
              <TableCell>{String(e.RefExt)}</TableCell>
              <TableCell>{String(e.Titre)}</TableCell>
              <TableCell>{String(e.Revision)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Button
          appearance="primary"
          size="large"
          onClick={async () => {
            try {
              const r = await api.post<{ folder: string }>(`/api/bordereaux/${id}/export`);
              setMsg(`Pack généré : ${r.folder}`);
              await api.download(`/api/bordereaux/${id}/download`, `${String(data.bordereau.NomComplet)}.zip`);
              toast("success", "ZIP EXPORT_BX téléchargé", r.folder);
            } catch (e) {
              toast("error", "Export / ZIP", e instanceof Error ? e.message : "échec");
            }
          }}
        >
          Exporter et télécharger le ZIP
        </Button>
        <Button
          onClick={async () => {
            try {
              const r = await api.post<{ folder: string }>(`/api/bordereaux/${id}/export`);
              setMsg(`Pack généré : ${r.folder}`);
              toast("success", "Pack EXPORT_BX généré", r.folder);
            } catch (e) {
              toast("error", "Export BX", e instanceof Error ? e.message : "échec");
            }
          }}
        >
          Générer le pack seulement
        </Button>
      </div>
      {msg ? <Body1 style={{ marginTop: 8 }}>{msg}</Body1> : null}
    </div>
  );
}
