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
  Title3,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export function BordereauDetailPage() {
  const { id } = useParams();
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
      .then(setData);

  useEffect(() => {
    reload();
  }, [id]);

  if (!data) return null;

  return (
    <div>
      <Title3>{String(data.bordereau.NomComplet)}</Title3>
      <Body1>Template {data.template}. Joindre des documents puis exporter le pack.</Body1>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <Input
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
          }}
        >
          Chercher
        </Button>
      </div>
      {docs.length ? (
        <Table size="small">
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
      ) : null}
      <Title3 style={{ marginTop: 16 }}>Envois</Title3>
      <Table>
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
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button
          appearance="primary"
          onClick={async () => {
            const r = await api.post<{ folder: string }>(`/api/bordereaux/${id}/export`);
            setMsg(`Pack généré : ${r.folder}`);
          }}
        >
          Exporter le pack
        </Button>
        <Button
          onClick={() => {
            const a = document.createElement("a");
            a.href = `/api/bordereaux/${id}/download`;
            a.download = `${String(data.bordereau.NomComplet)}.zip`;
            a.click();
          }}
        >
          Télécharger ZIP
        </Button>
      </div>
      {msg ? <Body1 style={{ marginTop: 8 }}>{msg}</Body1> : null}
    </div>
  );
}
