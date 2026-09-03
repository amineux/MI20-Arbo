import { Body1, Button, Checkbox } from "@fluentui/react-components";
import { useState } from "react";
import { PageHeader, useToast } from "../ui";

export function ExportPpdPage() {
  const [mask, setMask] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  return (
    <div>
      <PageHeader title="Export PPD">
        Génère un classeur PPD à partir des documents et jalons courants. Masque RATP <b>C, AA, AB, AC</b>.
      </PageHeader>
      <div style={{ marginTop: 16 }}>
        <Checkbox
          checked={mask}
          label="Masquer les colonnes RATP C, AA, AB, AC"
          onChange={(_, d) => setMask(!!d.checked)}
        />
      </div>
      <Button
        appearance="primary"
        style={{ marginTop: 12 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/exports/ppd", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ maskRatp: mask }),
            });
            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(err.error ?? "Export impossible");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `PPD_MI20_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast("success", "Export PPD téléchargé");
          } catch (e) {
            toast("error", "Export PPD", e instanceof Error ? e.message : "échec");
          } finally {
            setBusy(false);
          }
        }}
      >
        Générer le classeur PPD
      </Button>
      <Body1 className="mi20-note">Le classeur se télécharge dans le navigateur.</Body1>
    </div>
  );
}
