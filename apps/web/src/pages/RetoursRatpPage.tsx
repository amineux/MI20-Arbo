import {
  Body1,
  Button,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
  Tab,
  TabList,
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

interface FaBatch {
  batch: Record<string, unknown>;
  raw: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  kind?: string;
}

export function RetoursRatpPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [docs, setDocs] = useState<DocOpt[]>([]);
  const [avis, setAvis] = useState("FA");
  const [commentaire, setCommentaire] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<"list" | "import">("list");
  const [batch, setBatch] = useState<FaBatch | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

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

  const loadBatch = (id: number) => {
    api.get<FaBatch>(`/api/imports/${id}`).then(setBatch).catch((e: Error) => toast("error", "Import FA", e.message));
  };

  return (
    <div>
      <PageHeader title="Retours RATP / fiches d'avis" form="Form_SaisieRetoursRATP / ImportRetoursRATP">
        Import Excel (en-tête <b>NumLivrable</b>) puis application : met à jour <code>revision</code>,{" "}
        <code>envoi</code> et <code>fiche_avis</code>. Les lignes sans livrable correspondant sont listées, pas un
        no-op silencieux.
      </PageHeader>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)} style={{ margin: "16px 0" }}>
        <Tab value="list">Saisie / liste</Tab>
        <Tab value="import">Import Excel FA</Tab>
      </TabList>

      {tab === "import" ? (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setApplied(null);
                const fd = new FormData();
                fd.append("file", file);
                try {
                  const r = await api.post<{ batchId: number; rowCount: number; errorCount: number; matchedCount: number }>(
                    "/api/imports/fa",
                    fd,
                  );
                  toast("success", "Fiches d'avis chargées", `${r.rowCount} lignes · ${r.matchedCount} document(s) trouvé(s) · ${r.errorCount} erreur(s)`);
                  loadBatch(r.batchId);
                } catch (err) {
                  toast("error", "Import FA", err instanceof Error ? err.message : "échec");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              appearance="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setApplied(null);
                try {
                  const r = await api.post<{ batchId: number; rowCount: number; errorCount: number; matchedCount: number }>(
                    "/api/imports/fa/demo",
                  );
                  toast("success", "Exemple FA chargé", `${r.rowCount} lignes · ${r.matchedCount} document(s)`);
                  loadBatch(r.batchId);
                } catch (err) {
                  toast("error", "Import FA", err instanceof Error ? err.message : "échec");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Charger Import_Retours_RATP_exemple.xlsx
            </Button>
            {busy ? <Spinner size="tiny" /> : null}
          </div>
          {batch ? (
            <>
              <MessageBar intent="info">
                <MessageBarBody>
                  <MessageBarTitle>Lot {String(batch.batch.Id)}</MessageBarTitle>
                  {batch.raw.length} ligne(s), {batch.errors.length} erreur(s). Vérifiez puis appliquez — les livrables
                  inconnus restent en erreur.
                </MessageBarBody>
              </MessageBar>
              <div className="mi20-table-wrap">
                <Table size="extra-small">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Excel</TableHeaderCell>
                      <TableHeaderCell>Ligne</TableHeaderCell>
                      <TableHeaderCell>Avis</TableHeaderCell>
                      <TableHeaderCell>Fichier FA</TableHeaderCell>
                      <TableHeaderCell>Erreur</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.raw.slice(0, 200).map((r) => (
                      <TableRow key={String(r.Id)}>
                        <TableCell>{String(r.ligneEXCEL)}</TableCell>
                        <TableCell>
                          {r.GroupeLigne != null ? `${String(r.GroupeLigne)} / ${String(r.IndiceLigne)}` : "—"}
                        </TableCell>
                        <TableCell>{String(r.ReponseFicheAvis ?? "")}</TableCell>
                        <TableCell>{String(r.FichierFicheAvis ?? "")}</TableCell>
                        <TableCell>{String(r.erreur ?? "")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mi20-apply-bar">
                <Button
                  appearance="primary"
                  size="large"
                  disabled={applying || String(batch.batch.Status) === "applied"}
                  onClick={async () => {
                    setApplying(true);
                    try {
                      const r = await api.post<{
                        appliedFiches: number;
                        updatedEnvois: number;
                        updatedRevisions: number;
                        skippedErrors: number;
                        alreadyApplied?: boolean;
                      }>(`/api/imports/${Number(batch.batch.Id)}/apply`);
                      const msg = `${r.appliedFiches} fiche(s) · ${r.updatedEnvois} envoi(s) · ${r.updatedRevisions} révision(s) · ${r.skippedErrors} ignorée(s)`;
                      setApplied(msg);
                      toast("success", r.alreadyApplied ? "Déjà appliqué" : "Fiches d'avis appliquées", msg);
                      loadBatch(Number(batch.batch.Id));
                      load();
                    } catch (e) {
                      toast("error", "Application FA", e instanceof Error ? e.message : "échec");
                    } finally {
                      setApplying(false);
                    }
                  }}
                >
                  {applying ? <Spinner size="tiny" /> : null}
                  {String(batch.batch.Status) === "applied" ? "Lot FA déjà appliqué" : "Appliquer les fiches d'avis"}
                </Button>
                <span className="hint">
                  Équivalent Access ImportRetoursRATP : écrit ReponseFicheAvis / FichierFicheAvis sur envoi et
                  révision.
                </span>
              </div>
              {applied ? (
                <MessageBar intent="success" style={{ marginTop: 8 }}>
                  <MessageBarBody>{applied}</MessageBarBody>
                </MessageBar>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Aucun lot FA"
              detail="Chargez Import_Retours_RATP_exemple.xlsx (NumLivrable) ou un classeur équivalent."
            />
          )}
        </div>
      ) : (
        <>
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
              <Input value={avis} onChange={(_, d) => setAvis(d.value)} placeholder="FA / VA / VR…" />
            </Field>
            <Field label="Commentaire" style={{ minWidth: 240, flex: 1 }}>
              <Textarea value={commentaire} onChange={(_, d) => setCommentaire(d.value)} />
            </Field>
            <Button
              appearance="primary"
              onClick={async () => {
                try {
                  await api.post("/api/ratp-returns", {
                    avis,
                    commentaire,
                    idDocument: idDocument ? Number(idDocument) : undefined,
                  });
                  toast(
                    "success",
                    "Retour enregistré",
                    `${avis} — ${selected ? `${selected.GroupeLigne} / ${selected.IndiceLigne}` : ""}`,
                  );
                  setCommentaire("");
                  load();
                } catch (e) {
                  toast("error", "Retour RATP", e instanceof Error ? e.message : "échec");
                }
              }}
            >
              Enregistrer un retour
            </Button>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Aucun retour" detail="Saisissez un avis ou importez un Excel FA." />
          ) : (
            <div className="mi20-table-wrap">
              <Table size="extra-small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Avis</TableHeaderCell>
                    <TableHeaderCell>Ligne</TableHeaderCell>
                    <TableHeaderCell>Titre</TableHeaderCell>
                    <TableHeaderCell>Fichier FA</TableHeaderCell>
                    <TableHeaderCell>Commentaire</TableHeaderCell>
                    <TableHeaderCell>Utilisateur</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={String(r.Id)}>
                      <TableCell>{String(r.ReponseFicheAvis ?? r.Statut ?? r.Avis ?? "")}</TableCell>
                      <TableCell>
                        {r.GroupeLigne != null
                          ? `${String(r.GroupeLigne)} / ${String(r.IndiceLigne)}`
                          : `doc ${String(r.IdDocument ?? "—")}`}
                      </TableCell>
                      <TableCell>{String(r.Titre ?? "—")}</TableCell>
                      <TableCell>{String(r.FichierFicheAvis ?? r.NomFichier ?? "")}</TableCell>
                      <TableCell>{String(r.Commentaire ?? r.CommentairesRATP ?? "")}</TableCell>
                      <TableCell>{String(r.NomUtilisateur ?? "")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Body1 style={{ marginTop: 12 }}>
            L&apos;onglet <b>Import Excel FA</b> reprend ImportRetoursRATP (colonne NumLivrable).
          </Body1>
        </>
      )}
    </div>
  );
}
