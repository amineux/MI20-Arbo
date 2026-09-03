import {
  Body1,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  Option,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

interface LookupOpt {
  id: number;
  nom: string;
}

function LookupField({
  label,
  table,
  value,
  onChange,
}: {
  label: string;
  table: string;
  value: unknown;
  onChange: (id: number) => void;
}) {
  const [rows, setRows] = useState<LookupOpt[]>([]);
  useEffect(() => {
    api.get<{ rows: LookupOpt[] }>(`/api/lookups/${table}`).then((r) => setRows(r.rows)).catch(() => undefined);
  }, [table]);
  const selected = String(value ?? "");
  const nom = rows.find((r) => String(r.id) === selected)?.nom ?? "";
  return (
    <Field label={label}>
      <Dropdown
        value={nom}
        selectedOptions={selected ? [selected] : []}
        onOptionSelect={(_, d) => onChange(Number(d.optionValue))}
      >
        {rows.map((r) => (
          <Option key={r.id} value={String(r.id)}>
            {r.nom}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

export function DocumentEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [jalons, setJalons] = useState<Array<Record<string, unknown>>>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api
      .get<{ document: Record<string, unknown>; jalons: Array<Record<string, unknown>> }>(`/api/documents/${id}`)
      .then((r) => {
        setDoc(r.document);
        setJalons(r.jalons);
      });
  }, [id]);

  if (!doc) return <Spinner label="Chargement du document" />;

  const set = (k: string, v: unknown) => setDoc({ ...doc, [k]: v });

  return (
    <div>
      <Button onClick={() => nav("/documents")}>← Liste</Button>
      <PageHeader title={`Document ${String(doc.GroupeLigne)} / ${String(doc.IndiceLigne)}`}>
        Enregistrement écrit dans l&apos;historique champ à champ. Listes : nom affiché, identifiant stocké.
      </PageHeader>
      <div className="mi20-panel" style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 960 }}>
        <Field label="Référence externe">
          <Input value={String(doc.RefExt ?? "")} onChange={(_, d) => set("RefExt", d.value)} />
        </Field>
        <Field label="Indice de révision">
          <Input value={String(doc.Revision ?? "")} onChange={(_, d) => set("Revision", d.value)} />
        </Field>
        <Field label="Titre" style={{ gridColumn: "1 / -1" }}>
          <Input value={String(doc.Titre ?? "")} onChange={(_, d) => set("Titre", d.value)} />
        </Field>
        <Field label="Livrable" style={{ gridColumn: "1 / -1" }}>
          <Textarea value={String(doc.Livrable ?? "")} onChange={(_, d) => set("Livrable", d.value)} />
        </Field>
        <LookupField label="Fournisseur" table="fournisseur" value={doc.IdFournisseur} onChange={(v) => set("IdFournisseur", v)} />
        <LookupField label="Leader technique" table="Leader" value={doc.IdLeader} onChange={(v) => set("IdLeader", v)} />
        <LookupField label="PIC" table="PIC" value={doc.IDPic} onChange={(v) => set("IDPic", v)} />
        <LookupField
          label="Domaine chargeur"
          table="domaineChargeur"
          value={doc.IdDomaineChargeur}
          onChange={(v) => set("IdDomaineChargeur", v)}
        />
        <Field label="Nom du document source">
          <Input value={String(doc.Nom ?? "")} onChange={(_, d) => set("Nom", d.value)} />
        </Field>
        <Field label="Langue">
          <Input value={String(doc.Langue ?? "")} onChange={(_, d) => set("Langue", d.value)} />
        </Field>
        <Field label="Projet">
          <Input value={String(doc.Projet ?? "")} onChange={(_, d) => set("Projet", d.value)} />
        </Field>
        <Field label="Date de la prochaine soumission">
          <Input value={String(doc.DateResoumission ?? "")} onChange={(_, d) => set("DateResoumission", d.value)} />
        </Field>
        <Field label="Commentaires" style={{ gridColumn: "1 / -1" }}>
          <Textarea value={String(doc.CommentaireBT ?? "")} onChange={(_, d) => set("CommentaireBT", d.value)} />
        </Field>
        <Checkbox
          checked={Boolean(doc.DelivrableProjet)}
          label="Délivrable projet"
          onChange={(_, d) => set("DelivrableProjet", d.checked ? 1 : 0)}
        />
        <Checkbox
          checked={Boolean(doc.EstConfidentiel)}
          label="Confidentiel"
          onChange={(_, d) => set("EstConfidentiel", d.checked ? 1 : 0)}
        />
        <Checkbox
          checked={Boolean(doc.EstSecuritaire)}
          label="Sécuritaire"
          onChange={(_, d) => set("EstSecuritaire", d.checked ? 1 : 0)}
        />
        <Checkbox
          checked={Boolean(doc.Homologuant)}
          label="Homologuant"
          onChange={(_, d) => set("Homologuant", d.checked ? 1 : 0)}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <Button
          appearance="primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.put(`/api/documents/${id}`, doc);
              setMsg("Enregistré.");
              toast("success", "Document enregistré");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Erreur");
            } finally {
              setSaving(false);
            }
          }}
        >
          Enregistrer
        </Button>
        {msg ? <Body1 style={{ marginLeft: 12 }}>{msg}</Body1> : null}
      </div>
      <h2 style={{ marginTop: 28, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Jalons programmés</h2>
      {jalons.length === 0 ? (
        <Body1>Aucun jalon sur ce livrable.</Body1>
      ) : (
        <div className="mi20-table-wrap">
          <Table size="extra-small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
                <TableHeaderCell>Prévisionnel</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jalons.map((j) => (
                <TableRow key={String(j.Id)}>
                  <TableCell>{String(j.JalonCode ?? j.Code ?? "")}</TableCell>
                  <TableCell>{String(j.Version ?? "")}</TableCell>
                  <TableCell>{j.EstPrevisionnel ? "oui" : "non"}</TableCell>
                  <TableCell>{String(j.DatePrevisionnelle ?? "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
