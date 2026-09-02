import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  Spinner,
  Subtitle2,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "14px",
    marginTop: "24px",
  },
  cardLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    height: "100%",
  },
  card: {
    minHeight: "148px",
    height: "100%",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    transitionProperty: "transform, box-shadow",
    transitionDuration: "140ms",
    ":hover": {
      transform: "translateY(-3px)",
      boxShadow: tokens.shadow16,
    },
  },
  tour: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    marginTop: "16px",
    padding: "20px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow8,
  },
  step: { display: "flex", flexDirection: "column", gap: "10px" },
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
  muted: { color: tokens.colorNeutralForeground3, marginTop: "16px", fontSize: "12px" },
  lead: { maxWidth: "72ch", color: tokens.colorNeutralForeground2 },
});

const MODULES = [
  { to: "/documents", title: "Documents", form: "Form_EDIT_DOC + FILTRES_RECHERCHE", desc: "Liste, recherche, édition. Clé GroupeLigne + IndiceLigne." },
  { to: "/import-ppd", title: "Import PPD", form: "ImportPPD / Rapide / Jalons", desc: "Excel officiel → staging → diffs → application." },
  { to: "/export-ppd", title: "Export PPD", form: "DoExportPPD", desc: "Classeur PPD. Masque RATP C, AA, AB, AC." },
  { to: "/bordereaux", title: "Bordereaux", form: "Form_CREATE_BX / Form_MGT_BX", desc: "En-tête, pièces, pack EXPORT_BX." },
  { to: "/lookups", title: "Référentiels", form: "tables LDD (Nom)", desc: "Fournisseur, domaine chargeur, métier, PIC…" },
  { to: "/revisions", title: "Révisions", form: "Form_CREATE_REV", desc: "Indice de révision lié à la programmation jalon." },
  { to: "/retours-ratp", title: "Retours RATP", form: "Form_SaisieRetoursRATP", desc: "Fiches avis — saisie démo." },
  { to: "/kpi", title: "KPI / bilans", form: "export_KPI1 / BilanEnvois", desc: "Compteurs démo + templates officiels." },
  { to: "/rapports", title: "Rapports / audit", form: "Form_REPORT / doc_histo", desc: "Historique champ à champ." },
  { to: "/verrouillage", title: "Verrouillage", form: "Form_VerrouillageBase", desc: "Bannière de base verrouillée." },
];

export function HomePage() {
  const s = useStyles();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <Title3>Accueil</Title3>
      <Body1 className={s.lead}>
        Remplacement hébergé de l&apos;application Access <b>BASE ARBO MI20</b> (IHM 1.6.6) — PPD et bordereaux. Source
        des modules : <code>docs/handoff/TEKKY_BASE_ARBO_HANDOFF.md</code>.
      </Body1>

      <div className={s.tour}>
        <Subtitle2 style={{ gridColumn: "1 / -1" }}>Parcours démo (3 étapes guidées)</Subtitle2>
        <div className={s.step}>
          <span className={s.num}>1</span>
          <Body1>Ouvrir la liste (clé métier <b>36 / 9351.3</b>).</Body1>
          <Button appearance="primary" onClick={() => nav("/documents")}>
            Voir les documents
          </Button>
        </div>
        <div className={s.step}>
          <span className={s.num}>2</span>
          <Body1>
            Charge <b>Import_Rapide_exemple.xlsx</b>, ouvre les onglets, puis applique — toast avec les comptes.
          </Body1>
          <Button
            appearance="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              nav("/import-ppd", { state: { autorun: "rapide-apply" } });
            }}
          >
            {busy ? <Spinner size="tiny" /> : null} Lancer l&apos;import rapide
          </Button>
        </div>
        <div className={s.step}>
          <span className={s.num}>3</span>
          <Body1>Créer un bordereau CAF, rattacher un livrable, ZIP.</Body1>
          <Button appearance="primary" onClick={() => nav("/bordereaux")}>
            Créer un bordereau
          </Button>
        </div>
      </div>

      <div className={s.grid}>
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className={s.cardLink}>
            <Card className={s.card}>
              <CardHeader header={<b>{m.title}</b>} description={<Caption1>{m.form}</Caption1>} />
              <Body1>{m.desc}</Body1>
            </Card>
          </Link>
        ))}
      </div>
      <div className={s.muted}>Form_ARCHI n&apos;est pas un écran MVP (handoff).</div>
    </div>
  );
}
