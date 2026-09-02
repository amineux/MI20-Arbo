import { Body1, Button, Field, Input, Textarea, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, PageHeader, useToast } from "../ui";

export function RetoursRatpPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [avis, setAvis] = useState("FA");
  const [commentaire, setCommentaire] = useState("");
  const [idDocument, setIdDocument] = useState("");

  const load = () =>
    api.get<{ rows: Array<Record<string, unknown>> }>("/api/ratp-returns").then((r) => setRows(r.rows));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Retours RATP / fiche avis" form="Form_SaisieRetoursRATP">
        Saisie des retours et fichiers FA sur revision — écran utilisable en démo, sans inventer ImportRetoursRATP.
      </PageHeader>
      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap", alignItems: "end" }}>
        <Field label="Avis">
          <Input value={avis} onChange={(_, d) => setAvis(d.value)} />
        </Field>
        <Field label="Id document">
          <Input value={idDocument} onChange={(_, d) => setIdDocument(d.value)} placeholder="ex. 1" />
        </Field>
        <Field label="Commentaire">
          <Textarea value={commentaire} onChange={(_, d) => setCommentaire(d.value)} />
        </Field>
        <Button
          appearance="primary"
          onClick={async () => {
            await api.post("/api/ratp-returns", {
              avis,
              commentaire,
              idDocument: idDocument ? Number(idDocument) : undefined,
            });
            toast("success", "Retour enregistré (démo)");
            setCommentaire("");
            load();
          }}
        >
          Enregistrer un retour
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucun retour" detail="Saisissez un avis pour alimenter la liste locale." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Id</TableHeaderCell>
              <TableHeaderCell>Avis</TableHeaderCell>
              <TableHeaderCell>Document</TableHeaderCell>
              <TableHeaderCell>Commentaire</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.Id)}>
                <TableCell>{String(r.Id)}</TableCell>
                <TableCell>{String(r.Avis)}</TableCell>
                <TableCell>{String(r.IdDocument ?? "—")}</TableCell>
                <TableCell>{String(r.Commentaire)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Body1 style={{ marginTop: 12 }}>Import Excel des retours : non branché (handoff).</Body1>
    </div>
  );
}
