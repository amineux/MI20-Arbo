import { Body1, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, PageHeader } from "../ui";

export function RapportsPage() {
  const [histo, setHisto] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.get<{ histo: Array<Record<string, unknown>> }>("/api/reports").then((r) => setHisto(r.histo ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Rapports / audit" form="Form_REPORT / doc_histo">
        Journal champ à champ (Save_Histo_For). Alimenté à l&apos;import et à l&apos;édition document.
      </PageHeader>
      {histo.length === 0 ? (
        <EmptyState title="Pas encore d'historique" detail="Modifiez un document ou appliquez un import PPD." />
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
              <TableHeaderCell>User</TableHeaderCell>
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
      <Body1 style={{ marginTop: 12 }}>Exports PDF Crystal Reports : hors MVP.</Body1>
    </div>
  );
}
