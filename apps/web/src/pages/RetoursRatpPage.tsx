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
import { useEffect, useRef, useState } from "react";
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
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      <PageHeader title="Retours RATP / fiches d'avis">
        Import Excel (en-tête <b>NumLivrable</b>) puis application : met à jour révisions, envois et fiches d&apos;avis.
        Les lignes sans livrable correspondant restent en erreur.
      </PageHeader>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)} style={{ margin: "16px 0" }}>
        <Tab value="list">Saisie / liste</Tab>
        <Tab value="import">Import Excel FA</Tab>
      </TabList>

      {tab === "import" ? (
        <div>
          <div className="mi20-import-panel">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSelectedFileName(file.name);
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
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            />
            <div className="mi20-import-primary">
              <Button appearance="primary" size="large" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                Choisir un fichier Excel…
              </Button>
              {busy ? <Spinner size="tiny" /> : null}
            </div>
            {selectedFileName ? (
              <Body1 className="mi20-file-chip">Fichier sélectionné : <b>{selectedFileName}</b></Body1>
            ) : (
              <Body1 className="mi20-file-hint">En-tête attendu : <b>NumLivrable</b> — formats .xlsx / .xls.</Body1>
            )}
            <details className="mi20-demo-details">
              <summary>Exemple de démo</summary>
              <div className="mi20-demo-row">
                <Button
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
                  Import_Retours_RATP_exemple.xlsx
                </Button>
              </div>
            </details>
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
                <span className="hint">Écrit l&apos;avis et le fichier FA sur l&apos;envoi et la révision du livrable.</span>
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
              detail="Cliquez sur « Choisir un fichier Excel… » (NumLivrable) ou utilisez l’exemple de démo."
            />
          )}
        </div>
      ) : (
        <>
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
            <EmptyState
              title="Aucun retour"
              detail="Saisissez un avis, ou importez un classeur Excel (colonne NumLivrable)."
              action={
                <Button appearance="primary" onClick={() => setTab("import")}>
                  Ouvrir l&apos;import Excel
                </Button>
              }
            />
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
          <Body1 className="mi20-note">
            L&apos;onglet <b>Import Excel FA</b> attend la colonne NumLivrable.
          </Body1>
        </>
      )}
    </div>
  );
}
