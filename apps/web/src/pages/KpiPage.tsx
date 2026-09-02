import { Body1, Button } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

interface Tpl {
  file: string;
  role: string;
  labelFr: string;
}

export function KpiPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Tpl[]>([]);

  useEffect(() => {
    api.get<{ templates: Tpl[] }>("/api/kpi").then((r) => setTemplates(r.templates)).catch((e: Error) => toast("error", "KPI", e.message));
  }, [toast]);

  return (
    <div>
      <PageHeader title="KPI / bilan envois / documents d'autorisation" form="Form_EXPORT">
        Templates officiels du handoff (fixtures/). L&apos;export métier (remplissage) n&apos;est pas encore branché —
        téléchargement du classeur vierge pour travail.
      </PageHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16, maxWidth: 480 }}>
        {templates.map((t) => (
          <div key={t.file} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <Body1>
              {t.labelFr} <code>{t.file}</code>
            </Body1>
            <Button
              onClick={async () => {
                try {
                  await api.download(`/api/templates/${encodeURIComponent(t.file)}`, t.file);
                  toast("success", "Template téléchargé", t.file);
                } catch (e) {
                  toast("error", t.file, e instanceof Error ? e.message : "échec");
                }
              }}
            >
              Télécharger
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
