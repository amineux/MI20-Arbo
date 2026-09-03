import { Body1, Button } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader, useToast } from "../ui";

export function VerrouillagePage({ onChange }: { onChange: () => void }) {
  const { toast } = useToast();
  const [lock, setLock] = useState<{ locked: number; message: string | null } | null>(null);

  useEffect(() => {
    api.get<{ locked: number; message: string | null }>("/api/lock").then(setLock);
  }, []);

  return (
    <div>
      <PageHeader title="Verrouillage de la base">
        Lorsque la base est verrouillée, les écritures (import, édition, bordereaux, référentiels) sont refusées.
      </PageHeader>
      <div className="mi20-panel" style={{ marginTop: 20, maxWidth: 480 }}>
        <Body1>
          État : <b>{lock?.locked ? "verrouillée" : "ouverte"}</b>
        </Body1>
        {lock?.message ? <Body1 className="mi20-note">{lock.message}</Body1> : null}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Button
            appearance="primary"
            onClick={async () => {
              await api.post("/api/lock", { locked: true, message: "Base verrouillée pour maintenance." });
              setLock(await api.get("/api/lock"));
              onChange();
              toast("warning", "Base verrouillée", "Les mises à jour sont suspendues.");
            }}
          >
            Verrouiller
          </Button>
          <Button
            onClick={async () => {
              await api.post("/api/lock", { locked: false, message: null });
              setLock(await api.get("/api/lock"));
              onChange();
              toast("success", "Base déverrouillée");
            }}
          >
            Déverrouiller
          </Button>
        </div>
      </div>
    </div>
  );
}
