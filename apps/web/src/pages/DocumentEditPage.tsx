import { Body1, Button, Field, Input, Spinner, Textarea, Title3, Checkbox } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

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
      <PageHeader title={`Document ${String(doc.GroupeLigne)} / ${String(doc.IndiceLigne)}`} form="Form_EDIT_DOC">
        Livrable / document — enregistrement écrit doc_histo.
      </PageHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, maxWidth: 960 }}>
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
      <Title3 style={{ marginTop: 24 }}>Jalons programmés</Title3>
      <ul>
        {jalons.map((j) => (
          <li key={String(j.Id)}>
            {String(j.JalonCode)} — version {String(j.Version ?? "")} {j.EstPrevisionnel ? "(prévisionnel)" : ""}
          </li>
        ))}
        {jalons.length === 0 ? <li>Aucun jalon</li> : null}
      </ul>
    </div>
  );
}
