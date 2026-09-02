import { Body1, Button, Card, CardHeader, Caption1 } from "@fluentui/react-components";
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

const ROLE_FORM: Record<string, string> = {
  kpi: "export_KPI1",
  bilan: "BilanEnvois",
  docts: "DoctsAutorisation",
};

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
      <PageHeader title="KPI / bilan envois / documents d'autorisation" form="Form_EXPORT · export_KPI1">
        Compteurs de la base démo (documents, jalons, envois). Les templates officiels du handoff se téléchargent
        tels quels — le remplissage métier (CopyFromRecordset) n&apos;est pas encore branché.
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {templates.map((t) => (
          <Card key={t.file}>
            <CardHeader header={<b>{t.labelFr}</b>} description={<Caption1>{ROLE_FORM[t.role] ?? t.role}</Caption1>} />
            <Body1>
              <code>{t.file}</code>
            </Body1>
            <div style={{ marginTop: 12 }}>
              <Button
                appearance="primary"
                onClick={async () => {
                  try {
                    await api.download(`/api/templates/${encodeURIComponent(t.file)}`, t.file);
                    toast("success", "Template téléchargé", t.file);
                  } catch (e) {
                    toast("error", t.file, e instanceof Error ? e.message : "échec");
                  }
                }}
              >
                Télécharger le classeur
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
