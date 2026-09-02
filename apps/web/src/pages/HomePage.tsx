import {
  Body1,
  Button,
  Card,
  CardHeader,
  makeStyles,
  Subtitle2,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { Link } from "react-router-dom";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "14px",
    marginTop: "16px",
  },
  card: {
    minHeight: "132px",
    height: "100%",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  },
  tour: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
    marginTop: "12px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  step: { display: "flex", flexDirection: "column", gap: "8px" },
  num: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "#1B365D",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: "13px",
  },
  muted: { color: tokens.colorNeutralForeground3, marginTop: "8px" },
});

const MODULES = [
  { to: "/documents", title: "Documents", form: "Form_EDIT_DOC + FILTRES_RECHERCHE", desc: "Liste, recherche, édition. Clé GroupeLigne + IndiceLigne." },
  { to: "/import-ppd", title: "Import PPD", form: "ImportPPD / Rapide / Jalons", desc: "Excel officiel → staging → diffs → application." },
  { to: "/export-ppd", title: "Export PPD", form: "DoExportPPD", desc: "Classeur PPD. Masque RATP C, AA, AB, AC." },
  { to: "/bordereaux", title: "Bordereaux", form: "Form_CREATE_BX / Form_MGT_BX", desc: "En-tête, pièces, pack EXPORT_BX." },
  { to: "/lookups", title: "Référentiels", form: "tables LDD (Nom)", desc: "Fournisseur, domaine chargeur, métier, PIC…" },
  { to: "/revisions", title: "Révisions", form: "Form_CREATE_REV", desc: "Indice de révision lié à la programmation jalon." },
  { to: "/retours-ratp", title: "Retours RATP", form: "Form_SaisieRetoursRATP", desc: "Fiches avis — saisie démo." },
  { to: "/kpi", title: "KPI / bilans", form: "export_KPI1 / BilanEnvois", desc: "Télécharger les templates officiels." },
  { to: "/rapports", title: "Rapports / audit", form: "Form_REPORT / doc_histo", desc: "Historique champ à champ." },
  { to: "/verrouillage", title: "Verrouillage", form: "Form_VerrouillageBase", desc: "Bannière de base verrouillée." },
];

export function HomePage() {
  const s = useStyles();
  return (
    <div>
      <Title3>Accueil</Title3>
      <Body1>
        Remplacement hébergé de l&apos;application Access <b>BASE ARBO MI20</b> (IHM 1.6.6) — PPD et bordereaux. Source
        des modules : <code>docs/handoff/TEKKY_BASE_ARBO_HANDOFF.md</code>.
      </Body1>

      <div className={s.tour}>
        <Subtitle2 style={{ gridColumn: "1 / -1" }}>Parcours démo (3 clics)</Subtitle2>
        <div className={s.step}>
          <span className={s.num}>1</span>
          <Body1>Ouvrir la liste des documents (clé métier 36 / 9351.3).</Body1>
          <Link to="/documents">
            <Button appearance="primary">Documents</Button>
          </Link>
        </div>
        <div className={s.step}>
          <span className={s.num}>2</span>
          <Body1>Charger Import_Rapide_exemple.xlsx, comparer, appliquer.</Body1>
          <Link to="/import-ppd">
            <Button appearance="primary">Import PPD</Button>
          </Link>
        </div>
        <div className={s.step}>
          <span className={s.num}>3</span>
          <Body1>Créer un bordereau, rattacher un livrable, exporter le ZIP.</Body1>
          <Link to="/bordereaux">
            <Button appearance="primary">Bordereaux</Button>
          </Link>
        </div>
      </div>

      <div className={s.grid}>
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className={s.card}>
            <Card>
              <CardHeader header={<b>{m.title}</b>} description={m.form} />
              <Body1>{m.desc}</Body1>
            </Card>
          </Link>
        ))}
      </div>
      <div className={s.muted}>Form_ARCHI n&apos;est pas un écran MVP (handoff).</div>
    </div>
  );
}
