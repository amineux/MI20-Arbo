import {
  Body1,
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, PageHeader, useToast } from "../ui";

interface DocOpt {
  Id: number;
  GroupeLigne: number;
  IndiceLigne: string;
  Titre: string;
}

export function RetoursRatpPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [docs, setDocs] = useState<DocOpt[]>([]);
  const [avis, setAvis] = useState("FA");
  const [commentaire, setCommentaire] = useState("");
  const [idDocument, setIdDocument] = useState("");

  const load = () =>
    api.get<{ rows: Array<Record<string, unknown>> }>("/api/ratp-returns").then((r) => setRows(r.rows));

  useEffect(() => {
    load();
    api.get<{ rows: DocOpt[] }>("/api/documents?pageSize=50").then((r) => {
      setDocs(r.rows);
      if (r.rows[0] && !idDocument) setIdDocument(String(r.rows[0].Id));
    });
  }, []);

  const selected = docs.find((d) => String(d.Id) === idDocument);

  return (
    <div>
      <PageHeader title="Retours RATP / fiche avis" form="Form_SaisieRetoursRATP">
        Saisie des retours et fichiers FA sur révision — écran utilisable en démo, sans inventer ImportRetoursRATP. Une
        fiche seedée sur 36 / 9351.3 est déjà présente.
      </PageHeader>
      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap", alignItems: "end" }}>
        <Field label="Document">
          <Dropdown
            style={{ minWidth: 280 }}
            value={selected ? `${selected.GroupeLigne} / ${selected.IndiceLigne}` : ""}
            selectedOptions={idDocument ? [idDocument] : []}
            onOptionSelect={(_, d) => setIdDocument(d.optionValue ?? "")}
          >
            {docs.map((d) => (
              <Option key={d.Id} value={String(d.Id)} text={`${d.GroupeLigne} / ${d.IndiceLigne} — ${d.Titre}`}>
                {d.GroupeLigne} / {d.IndiceLigne} — {d.Titre}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Avis">
          <Input value={avis} onChange={(_, d) => setAvis(d.value)} placeholder="FA" />
        </Field>
        <Field label="Commentaire" style={{ minWidth: 240, flex: 1 }}>
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
            toast("success", "Retour enregistré", `${avis} — ${selected ? `${selected.GroupeLigne} / ${selected.IndiceLigne}` : ""}`);
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
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Avis</TableHeaderCell>
                <TableHeaderCell>Ligne</TableHeaderCell>
                <TableHeaderCell>Titre</TableHeaderCell>
                <TableHeaderCell>Commentaire</TableHeaderCell>
                <TableHeaderCell>Utilisateur</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.Id)}>
                  <TableCell>{String(r.Avis)}</TableCell>
                  <TableCell>
                    {r.GroupeLigne != null ? `${String(r.GroupeLigne)} / ${String(r.IndiceLigne)}` : `doc ${String(r.IdDocument ?? "—")}`}
                  </TableCell>
                  <TableCell>{String(r.Titre ?? "—")}</TableCell>
                  <TableCell>{String(r.Commentaire)}</TableCell>
                  <TableCell>{String(r.NomUtilisateur ?? "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Body1 style={{ marginTop: 12 }}>Import Excel des retours : non branché (handoff).</Body1>
    </div>
  );
}
