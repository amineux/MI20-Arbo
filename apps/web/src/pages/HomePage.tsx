import { Body1, Button, Card, CardHeader, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "16px",
    marginTop: "16px",
  },
  card: { cursor: "pointer", minHeight: "140px" },
  muted: { color: tokens.colorNeutralForeground3, marginTop: "8px" },
});

const MODULES = [
  { to: "/documents", title: "Documents", form: "Form_EDIT_DOC + FILTRES_RECHERCHE", desc: "Liste, recherche, édition. Clé GroupeLigne + IndiceLigne." },
  { to: "/import-ppd", title: "Import PPD", form: "Form_import_compare / nouveaux docs", desc: "Excel → staging → diffs → application. Complet ou rapide." },
  { to: "/export-ppd", title: "Export PPD", form: "Form_EXPORT / DoExportPPD", desc: "Classeur PPD. Masque RATP C, AA, AB, AC." },
  { to: "/bordereaux", title: "Bordereaux", form: "Form_CREATE_BX / Form_MGT_BX", desc: "En-tête, pièces, envois, pack EXPORT_BX." },
  { to: "/lookups", title: "Référentiels", form: "tables LDD", desc: "Fournisseur, domaine chargeur, métier, PIC…" },
  { to: "/revisions", title: "Révisions", form: "Form_CREATE_REV", desc: "Module suivant (route + état vide)." },
  { to: "/retours-ratp", title: "Retours RATP", form: "Form_SaisieRetoursRATP", desc: "Fiches avis — à brancher." },
  { to: "/kpi", title: "KPI / bilans", form: "export_KPI1 / BilanEnvois", desc: "Templates d'export — à brancher." },
  { to: "/rapports", title: "Rapports / audit", form: "Form_REPORT / doc_histo", desc: "Historique des champs." },
  { to: "/verrouillage", title: "Verrouillage", form: "Form_VerrouillageBase", desc: "Bannière de base verrouillée." },
];

export function HomePage() {
  const s = useStyles();
  const nav = useNavigate();
  return (
    <div>
      <Title3>Accueil</Title3>
      <Body1>
        Remplacement hébergé SharePoint de l&apos;application Access BASE ARBO (IHM 1.6.6). Choisissez un module.
      </Body1>
      <div className={s.grid}>
        {MODULES.map((m) => (
          <Card key={m.to} className={s.card} onClick={() => nav(m.to)}>
            <CardHeader header={<b>{m.title}</b>} description={m.form} />
            <Body1>{m.desc}</Body1>
          </Card>
        ))}
      </div>
      <div className={s.muted}>
        <Button appearance="transparent" onClick={() => nav("/documents")}>
          Ouvrir les documents
        </Button>
      </div>
    </div>
  );
}
