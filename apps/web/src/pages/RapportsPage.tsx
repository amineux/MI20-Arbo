import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Input, Button, Body1 } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { EmptyState, PageHeader } from "../ui";

export function RapportsPage() {
  const [histo, setHisto] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 50;

  useEffect(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) q.set("search", search.trim());
    api
      .get<{ histo: Array<Record<string, unknown>>; total?: number }>(`/api/reports?${q}`)
      .then((r) => {
        setHisto(r.histo ?? []);
        setTotal(Number(r.total ?? r.histo?.length ?? 0));
      });
  }, [page, search]);

  return (
    <div>
      <PageHeader title="Rapports / audit">
        Journal champ à champ (<b>doc_histo</b>), alimenté à l&apos;import PPD et à l&apos;édition d&apos;un document.
        Pagination côté API — Access en a ~196 000 lignes.
      </PageHeader>
      <div className="mi20-toolbar">
        <Input
          style={{ minWidth: 280, flex: 1 }}
          placeholder="Champ, utilisateur, n° ligne…"
          value={search}
          onChange={(_, d) => {
            setSearch(d.value);
            setPage(1);
          }}
        />
      </div>
      {histo.length === 0 ? (
        <EmptyState
          title="Pas encore d'historique"
          detail="Modifiez un document ou appliquez un import PPD."
          action={
            <Link to="/import-ppd">
              <Button appearance="primary">Importer un PPD</Button>
            </Link>
          }
        />
      ) : (
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Quand</TableHeaderCell>
                <TableHeaderCell>Ligne</TableHeaderCell>
                <TableHeaderCell>Champ</TableHeaderCell>
                <TableHeaderCell>Ancien</TableHeaderCell>
                <TableHeaderCell>Nouveau</TableHeaderCell>
                <TableHeaderCell>Utilisateur</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {histo.map((h) => (
                <TableRow key={String(h.Id)}>
                  <TableCell>{String(h.ChangedAt ?? "")}</TableCell>
                  <TableCell>
                    {String(h.GroupeLigne)} / {String(h.IndiceLigne)}
                  </TableCell>
                  <TableCell>{String(h.FieldName)}</TableCell>
                  <TableCell>{String(h.OldValue ?? "")}</TableCell>
                  <TableCell>{String(h.NewValue ?? "")}</TableCell>
                  <TableCell>{String(h.UserName ?? "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Précédent
        </Button>
        <Body1>
          Page {page} — {total} ligne(s)
        </Body1>
        <Button disabled={histo.length < pageSize} onClick={() => setPage((p) => p + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
