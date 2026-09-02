import { Body1, Button, Field, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, PageHeader, useToast } from "../ui";

export function RevisionsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [revision, setRevision] = useState("B");
  const [idDocument, setIdDocument] = useState("");

  const load = () =>
    api.get<{ rows: Array<Record<string, unknown>> }>("/api/revisions").then((r) => setRows(r.rows));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Révisions" form="Form_CREATE_REV">
        Indice de révision lié à programmation_jalon (clé IdDocument + IdJalon). Saisie démo uniquement — pas de règles
        métier inventées hors handoff.
      </PageHeader>
      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap", alignItems: "end" }}>
        <Field label="Indice">
          <Input value={revision} onChange={(_, d) => setRevision(d.value)} />
        </Field>
        <Field label="Id document (optionnel)">
          <Input value={idDocument} onChange={(_, d) => setIdDocument(d.value)} placeholder="ex. 1" />
        </Field>
        <Button
          appearance="primary"
          onClick={async () => {
            await api.post("/api/revisions", { revision, idDocument: idDocument ? Number(idDocument) : undefined });
            toast("success", "Révision enregistrée (démo)");
            setRevision("");
            load();
          }}
        >
          Créer une révision
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucune révision" detail="Créez un indice pour tester l'écran (données locales)." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Id</TableHeaderCell>
              <TableHeaderCell>Révision</TableHeaderCell>
              <TableHeaderCell>Document</TableHeaderCell>
              <TableHeaderCell>Utilisateur</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.Id)}>
                <TableCell>{String(r.Id)}</TableCell>
                <TableCell>{String(r.Revision)}</TableCell>
                <TableCell>{String(r.IdDocument ?? "—")}</TableCell>
                <TableCell>{String(r.NomUtilisateur ?? "")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Body1 style={{ marginTop: 12 }}>Fiches avis fichier : phase suivante (Form_SaisieRetoursRATP).</Body1>
    </div>
  );
}
