import { Body1, Button, Checkbox, Title3 } from "@fluentui/react-components";
import { useState } from "react";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

export function ExportPpdPage() {
  const [mask, setMask] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <Title3>Export PPD</Title3>
      <Body1>
        DoExportPPD — remplissage du template officiel <b>fixtures/PPD_Template.xlsx</b> (jalons colonnes 44–66 / dates
        67–89). Copie sous storage/templates/ au démarrage. Pas de dumps EXPORT_PPD de production.
      </Body1>
      <div style={{ marginTop: 16 }}>
        <Checkbox
          checked={mask}
          label="Masquer les colonnes RATP C, AA, AB, AC ([EXPORT_RATP] COLONNES_A_MASQUER)"
          onChange={(_, d) => setMask(!!d.checked)}
        />
      </div>
      <Button
        appearance="primary"
        style={{ marginTop: 12 }}
        onClick={async () => {
          const res = await fetch(`${BASE}/api/exports/ppd`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maskRatp: mask }),
          });
          if (!res.ok) {
            setMsg("Export impossible");
            return;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `PPD_MI20_${new Date().toISOString().slice(0, 10)}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          setMsg("Export téléchargé (copie aussi dans storage/EXPORT_PPD).");
        }}
      >
        Générer le classeur PPD
      </Button>
      {msg ? <Body1 style={{ marginTop: 8 }}>{msg}</Body1> : null}
    </div>
  );
}
