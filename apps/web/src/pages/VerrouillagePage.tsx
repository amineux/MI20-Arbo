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
      <PageHeader title="Verrouillage de la base" form="Form_VerrouillageBase">
        Bannière globale lorsque la base est verrouillée. Les règles métier (import en cours, etc.) seront enrichies
        ensuite.
      </PageHeader>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Button
          appearance="primary"
          onClick={async () => {
            await api.post("/api/lock", { locked: true, message: "Base verrouillée pour maintenance (démo)." });
            setLock(await api.get("/api/lock"));
            onChange();
            toast("warning", "Base verrouillée");
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
      <Body1 style={{ marginTop: 16 }}>État : {lock?.locked ? "verrouillée" : "ouverte"}</Body1>
      {lock?.message ? <Body1>{lock.message}</Body1> : null}
    </div>
  );
}
