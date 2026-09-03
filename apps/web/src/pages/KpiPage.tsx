import { Body1, Button } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

interface Tpl {
  file: string;
  role: string;
  labelFr: string;
}

interface KpiPayload {
  templates: Tpl[];
  stats?: {
    documents: number;
    jalonsProgrammes: number;
    bordereaux: number;
    revisions: number;
    retoursRatp: number;
    histo: number;
  };
}

export function KpiPage() {
  const { toast } = useToast();
  const [data, setData] = useState<KpiPayload | null>(null);

  useEffect(() => {
    api
      .get<KpiPayload>("/api/kpi")
      .then(setData)
      .catch((e: Error) => toast("error", "KPI", e.message));
  }, [toast]);

  const stats = data?.stats;
  const templates = data?.templates ?? [];

  return (
    <div>
      <PageHeader title="KPI / bilan envois">
        Compteurs de la base : documents, jalons, bordereaux, révisions et fiches d&apos;avis. Téléchargez les modèles
        de classeurs officiels.
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
        {templates.map((t) => (
          <div key={t.file} className="mi20-panel">
            <div style={{ fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>{t.labelFr}</div>
            <Body1 className="mi20-note" style={{ marginTop: 0 }}>
              {t.file}
            </Body1>
            <div style={{ marginTop: 14 }}>
              <Button
                appearance="primary"
                onClick={async () => {
                  try {
                    await api.download(`/api/templates/${encodeURIComponent(t.file)}`, t.file);
                    toast("success", "Classeur téléchargé", t.file);
                  } catch (e) {
                    toast("error", t.file, e instanceof Error ? e.message : "échec");
                  }
                }}
              >
                Télécharger
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
