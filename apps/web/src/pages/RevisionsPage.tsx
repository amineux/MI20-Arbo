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

export function RevisionsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [docs, setDocs] = useState<DocOpt[]>([]);
  const [revision, setRevision] = useState("B");
  const [idDocument, setIdDocument] = useState("");

  const load = () =>
    api.get<{ rows: Array<Record<string, unknown>> }>("/api/revisions").then((r) => setRows(r.rows));

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
      <PageHeader title="Révisions" form="Form_CREATE_REV">
        Indice de révision lié à programmation_jalon (clé IdDocument + IdJalon). Saisie démo — pas de règles métier
        inventées hors handoff. Les lignes seedées (A sur 36 / 9351.3, B sur 40 / 12) montrent l&apos;écran vivant.
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
        <Field label="Indice">
          <Input value={revision} onChange={(_, d) => setRevision(d.value)} />
        </Field>
        <Button
          appearance="primary"
          onClick={async () => {
            await api.post("/api/revisions", {
              revision,
              idDocument: idDocument ? Number(idDocument) : undefined,
            });
            toast("success", "Révision enregistrée", `${revision} sur ${selected ? `${selected.GroupeLigne} / ${selected.IndiceLigne}` : "document"}`);
            load();
          }}
        >
          Créer une révision
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucune révision" detail="Créez un indice pour tester l'écran (données locales)." />
      ) : (
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Indice</TableHeaderCell>
                <TableHeaderCell>Ligne</TableHeaderCell>
                <TableHeaderCell>Titre</TableHeaderCell>
                <TableHeaderCell>Utilisateur</TableHeaderCell>
                <TableHeaderCell>Commentaire</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.Id)}>
                  <TableCell>{String(r.Revision)}</TableCell>
                  <TableCell>
                    {r.GroupeLigne != null ? `${String(r.GroupeLigne)} / ${String(r.IndiceLigne)}` : `doc ${String(r.IdDocument ?? "—")}`}
                  </TableCell>
                  <TableCell>{String(r.Titre ?? "—")}</TableCell>
                  <TableCell>{String(r.NomUtilisateur ?? "")}</TableCell>
                  <TableCell>{String(r.Commentaire ?? "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Body1 style={{ marginTop: 12 }}>Fichiers fiche avis sur révision : phase suivante (Form_SaisieRetoursRATP).</Body1>
    </div>
  );
}
