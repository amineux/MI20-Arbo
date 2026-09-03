import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@fluentui/react-components";
import { api } from "../api";
import { EmptyState, PageHeader } from "../ui";

export function RapportsPage() {
  const [histo, setHisto] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.get<{ histo: Array<Record<string, unknown>> }>("/api/reports").then((r) => setHisto(r.histo ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Rapports / audit">
        Journal champ à champ, alimenté à l&apos;import PPD et à l&apos;édition d&apos;un document.
      </PageHeader>
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
    </div>
  );
}
