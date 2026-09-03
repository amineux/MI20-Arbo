import {
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

interface JalonOpt {
  Id: number;
  JalonCode?: string;
  Code?: string;
  Version?: string;
}

export function RevisionsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [docs, setDocs] = useState<DocOpt[]>([]);
  const [jalons, setJalons] = useState<JalonOpt[]>([]);
  const [revision, setRevision] = useState("B");
  const [idDocument, setIdDocument] = useState("");
  const [idJalon, setIdJalon] = useState("");

  const load = () =>
    api.get<{ rows: Array<Record<string, unknown>> }>("/api/revisions").then((r) => setRows(r.rows));

  useEffect(() => {
    load();
    api.get<{ rows: DocOpt[] }>("/api/documents?pageSize=50").then((r) => {
      setDocs(r.rows);
      if (r.rows[0] && !idDocument) setIdDocument(String(r.rows[0].Id));
    });
  }, []);

  useEffect(() => {
    if (!idDocument) {
      setJalons([]);
      setIdJalon("");
      return;
    }
    api
      .get<{ jalons: JalonOpt[] }>(`/api/documents/${idDocument}`)
      .then((r) => {
        setJalons(r.jalons);
        setIdJalon(r.jalons[0] ? String(r.jalons[0].Id) : "");
      })
      .catch(() => {
        setJalons([]);
        setIdJalon("");
      });
  }, [idDocument]);

  const selected = docs.find((d) => String(d.Id) === idDocument);
  const selectedJalon = jalons.find((j) => String(j.Id) === idJalon);

  return (
    <div>
      <PageHeader title="Révisions">
        Indice de révision lié à un jalon programmé du livrable (clé document + jalon).
      </PageHeader>
      <div className="mi20-toolbar">
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
        <Field label="Jalon">
          <Dropdown
            style={{ minWidth: 180 }}
            value={
              selectedJalon
                ? `${selectedJalon.JalonCode ?? selectedJalon.Code ?? "—"} · ${selectedJalon.Version ?? ""}`
                : jalons.length
                  ? ""
                  : "Aucun jalon"
            }
            selectedOptions={idJalon ? [idJalon] : []}
            onOptionSelect={(_, d) => setIdJalon(d.optionValue ?? "")}
          >
            {jalons.map((j) => {
              const label = `${j.JalonCode ?? j.Code ?? "—"} · ${j.Version ?? ""}`;
              return (
                <Option key={j.Id} value={String(j.Id)} text={label}>
                  {label}
                </Option>
              );
            })}
          </Dropdown>
        </Field>
        <Field label="Indice">
          <Input value={revision} onChange={(_, d) => setRevision(d.value)} />
        </Field>
        <Button
          appearance="primary"
          onClick={async () => {
            try {
              await api.post("/api/revisions", {
                revision,
                idDocument: idDocument ? Number(idDocument) : undefined,
                idProgrammationJalon: idJalon ? Number(idJalon) : undefined,
              });
              toast(
                "success",
                "Révision enregistrée",
                `${revision} sur ${selected ? `${selected.GroupeLigne} / ${selected.IndiceLigne}` : "document"}`,
              );
              load();
            } catch (e) {
              toast("error", "Révision", e instanceof Error ? e.message : "échec");
            }
          }}
        >
          Créer une révision
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucune révision" detail="Choisissez un document, un jalon, puis un indice." />
      ) : (
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Indice</TableHeaderCell>
                <TableHeaderCell>Ligne</TableHeaderCell>
                <TableHeaderCell>Titre</TableHeaderCell>
                <TableHeaderCell>Jalon</TableHeaderCell>
                <TableHeaderCell>Utilisateur</TableHeaderCell>
                <TableHeaderCell>Commentaire</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.Id)}>
                  <TableCell>{String(r.Revision)}</TableCell>
                  <TableCell>
                    {r.GroupeLigne != null
                      ? `${String(r.GroupeLigne)} / ${String(r.IndiceLigne)}`
                      : `doc ${String(r.IdDocument ?? "—")}`}
                  </TableCell>
                  <TableCell>{String(r.Titre ?? "—")}</TableCell>
                  <TableCell>
                    {r.JalonCode != null
                      ? `${String(r.JalonCode)}${r.JalonVersion ? ` · ${String(r.JalonVersion)}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>{String(r.NomUtilisateur ?? "")}</TableCell>
                  <TableCell>{String(r.Commentaire ?? "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
