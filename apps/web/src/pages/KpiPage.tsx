import { Body1, Button } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

interface Tpl {
  file: string;
  role: string;
  labelFr: string;
}

interface KpiExport {
  kind: string;
  path: string;
  labelFr: string;
}

interface KpiPayload {
  templates: Tpl[];
  exports?: KpiExport[];
  stats?: {
    documents: number;
    jalonsProgrammes: number;
    bordereaux: number;
    revisions: number;
    retoursRatp: number;
    histo: number;
    envois?: number;
  };
}

export function KpiPage() {
  const { toast } = useToast();
  const [data, setData] = useState<KpiPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<KpiPayload>("/api/kpi")
      .then(setData)
      .catch((e: Error) => toast("error", "KPI", e.message));
  }, [toast]);

  const stats = data?.stats;
  const templates = data?.templates ?? [];
  const exports = data?.exports ?? [
    { kind: "kpi", path: "/api/exports/kpi", labelFr: "Exporter KPI (compteurs + par fournisseur / jalon)" },
    { kind: "bilan", path: "/api/exports/bilan-envois", labelFr: "Exporter le bilan des envois" },
    { kind: "docts", path: "/api/exports/docts-autorisation", labelFr: "Exporter les documents d'autorisation" },
  ];

  return (
    <div>
      <PageHeader title="KPI / bilan envois">
        Compteurs de la base et exports Access : KPI1, bilan des envois, documents d&apos;autorisation (Homologuant).
        Les modèles officiels restent téléchargeables ; les boutons d&apos;export remplissent un classeur à partir de
        la base (équivalent CopyFromRecordset).
      </PageHeader>
      {stats ? (
        <div className="mi20-stat-grid">
          <div className="mi20-stat">
            <div className="n">{stats.documents}</div>
            <div className="l">Documents</div>
          </div>
          <div className="mi20-stat">
            <div className="n">{stats.jalonsProgrammes}</div>
            <div className="l">Jalons programmés</div>
          </div>
          <div className="mi20-stat">
            <div className="n">{stats.bordereaux}</div>
            <div className="l">Bordereaux</div>
          </div>
          <div className="mi20-stat">
            <div className="n">{stats.envois ?? "—"}</div>
            <div className="l">Envois</div>
          </div>
          <div className="mi20-stat">
            <div className="n">{stats.revisions}</div>
            <div className="l">Révisions</div>
          </div>
          <div className="mi20-stat">
            <div className="n">{stats.retoursRatp}</div>
            <div className="l">Retours RATP</div>
          </div>
          <div className="mi20-stat">
            <div className="n">{stats.histo}</div>
            <div className="l">Lignes d&apos;audit</div>
          </div>
        </div>
      ) : null}
      <h2 style={{ fontSize: 18, marginTop: 24 }}>Exports remplis depuis la base</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
        {exports.map((t) => (
          <div key={t.kind} className="mi20-panel">
            <div style={{ fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>{t.labelFr}</div>
            <Body1 className="mi20-note" style={{ marginTop: 0 }}>
              {t.path}
            </Body1>
            <div style={{ marginTop: 14 }}>
              <Button
                appearance="primary"
                disabled={busy === t.kind}
                onClick={async () => {
                  setBusy(t.kind);
                  try {
                    await api.postDownload(t.path, `${t.kind}.xlsx`);
                    toast("success", "Export téléchargé", t.labelFr);
                  } catch (e) {
                    toast("error", t.labelFr, e instanceof Error ? e.message : "échec");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Exporter les données
              </Button>
            </div>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 18, marginTop: 28 }}>Modèles officiels (calques Access)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
        {templates.map((t) => (
          <div key={t.file} className="mi20-panel">
            <div style={{ fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>{t.labelFr}</div>
            <Body1 className="mi20-note" style={{ marginTop: 0 }}>
              {t.file}
            </Body1>
            <div style={{ marginTop: 14 }}>
              <Button
                onClick={async () => {
                  try {
                    await api.download(`/api/templates/${encodeURIComponent(t.file)}`, t.file);
                    toast("success", "Classeur téléchargé", t.file);
                  } catch (e) {
                    toast("error", t.file, e instanceof Error ? e.message : "échec");
                  }
                }}
              >
                Télécharger le modèle
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
