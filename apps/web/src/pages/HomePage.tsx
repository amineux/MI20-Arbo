import { Body1, Button, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api";

const useStyles = makeStyles({
  title: {
    margin: 0,
    fontSize: "40px",
    lineHeight: "1.08",
    fontWeight: 600,
    letterSpacing: "-0.035em",
    color: "#1d1d1f",
  },
  lead: {
    maxWidth: "40rem",
    color: tokens.colorNeutralForeground2,
    fontSize: "17px",
    lineHeight: "1.5",
    marginTop: "10px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "12px",
    marginTop: "28px",
  },
  cardLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    height: "100%",
  },
  card: {
    minHeight: "132px",
    height: "100%",
    padding: "20px 22px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "20px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(27, 54, 93, 0.05)",
    transitionProperty: "transform, box-shadow",
    transitionDuration: "160ms",
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 8px 28px rgba(27, 54, 93, 0.10)",
    },
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "17px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  cardDesc: {
    margin: 0,
    color: tokens.colorNeutralForeground2,
    fontSize: "14px",
    lineHeight: "1.45",
  },
  tour: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px",
    marginTop: "28px",
    padding: "22px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "20px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(27, 54, 93, 0.05)",
  },
  tourTitle: {
    gridColumn: "1 / -1",
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: tokens.colorNeutralForeground3,
  },
  step: { display: "flex", flexDirection: "column", gap: "10px" },
  num: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    backgroundColor: "rgba(27, 54, 93, 0.10)",
    color: "#1B365D",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: "12px",
  },
});

const MODULES = [
  { to: "/documents", title: "Documents", desc: "Liste, recherche et édition. Clé GroupeLigne + IndiceLigne." },
  { to: "/import-ppd", title: "Import PPD", desc: "Choisir un Excel, comparer les écarts, appliquer par lot." },
  { to: "/export-ppd", title: "Export PPD", desc: "Classeur PPD à partir de l'état courant. Masque RATP C, AA, AB, AC." },
  { to: "/bordereaux", title: "Bordereaux", desc: "En-tête CAF, pièces jointes, pack ZIP EXPORT_BX." },
  { to: "/lookups", title: "Référentiels", desc: "Fournisseur, domaine chargeur, métier, PIC…" },
  { to: "/revisions", title: "Révisions", desc: "Indice de révision lié à un jalon programmé." },
  { to: "/retours-ratp", title: "Retours RATP", desc: "Import Excel FA et saisie — met à jour envois et révisions." },
  { to: "/kpi", title: "KPI / bilans", desc: "Compteurs de la base et modèles de classeurs." },
  { to: "/rapports", title: "Rapports / audit", desc: "Historique champ à champ." },
  { to: "/verrouillage", title: "Verrouillage", desc: "Suspend les écritures sur la base." },
];

interface Stats {
  documents: number;
  jalonsProgrammes: number;
  bordereaux: number;
  envois?: number;
  revisions: number;
  retoursRatp: number;
  histo: number;
}

export function HomePage() {
  const s = useStyles();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/api/stats").then(setStats).catch(() => undefined);
  }, []);

  return (
    <div>
      <h1 className={s.title}>Accueil</h1>
      <Body1 className={s.lead}>
        Plan de production documentaire MI20 — PPD, bordereaux et fiches d&apos;avis. Ouvrez un module ou suivez le
        parcours ci-dessous.
      </Body1>
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
            <div className="l">Fiches d&apos;avis</div>
          </div>
        </div>
      ) : null}

      <div className={s.tour}>
        <p className={s.tourTitle}>Pour commencer</p>
        <div className={s.step}>
          <span className={s.num}>1</span>
          <Body1>
            Ouvrir la liste (clé métier <b>36 / 9351.3</b>).
          </Body1>
          <Button appearance="primary" onClick={() => nav("/documents")}>
            Voir les documents
          </Button>
        </div>
        <div className={s.step}>
          <span className={s.num}>2</span>
          <Body1>Importer un classeur PPD, comparer, puis appliquer.</Body1>
          <Button
            appearance="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              nav("/import-ppd");
            }}
          >
            {busy ? <Spinner size="tiny" /> : null} Importer un PPD
          </Button>
        </div>
        <div className={s.step}>
          <span className={s.num}>3</span>
          <Body1>Créer un bordereau CAF, rattacher un livrable, ZIP EXPORT_BX.</Body1>
          <Button appearance="primary" onClick={() => nav("/bordereaux")}>
            Créer un bordereau
          </Button>
        </div>
        <div className={s.step}>
          <span className={s.num}>4</span>
          <Body1>Importer les fiches d&apos;avis (NumLivrable) — met à jour envois et révisions.</Body1>
          <Button appearance="primary" onClick={() => nav("/retours-ratp")}>
            Import fiches d&apos;avis
          </Button>
        </div>
      </div>

      <div className={s.grid}>
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className={s.cardLink}>
            <div className={s.card}>
              <h2 className={s.cardTitle}>{m.title}</h2>
              <p className={s.cardDesc}>{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
