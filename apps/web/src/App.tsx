import {
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
  Title3,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  BoxRegular,
  DatabaseRegular,
  DocumentRegular,
  HomeRegular,
  LockClosedRegular,
  ChartMultipleRegular,
  ClipboardTaskRegular,
  ArrowUploadRegular,
  HistoryRegular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";
import { hideBootSplash } from "./boot";
import { HomePage } from "./pages/HomePage";
import { Loading, ToastHost } from "./ui";

const DocumentsPage = lazy(() => import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const DocumentEditPage = lazy(() => import("./pages/DocumentEditPage").then((m) => ({ default: m.DocumentEditPage })));
const ImportPpdPage = lazy(() => import("./pages/ImportPpdPage").then((m) => ({ default: m.ImportPpdPage })));
const ExportPpdPage = lazy(() => import("./pages/ExportPpdPage").then((m) => ({ default: m.ExportPpdPage })));
const BordereauxPage = lazy(() => import("./pages/BordereauxPage").then((m) => ({ default: m.BordereauxPage })));
const BordereauDetailPage = lazy(() =>
  import("./pages/BordereauDetailPage").then((m) => ({ default: m.BordereauDetailPage })),
);
const LookupsPage = lazy(() => import("./pages/LookupsPage").then((m) => ({ default: m.LookupsPage })));
const RevisionsPage = lazy(() => import("./pages/RevisionsPage").then((m) => ({ default: m.RevisionsPage })));
const RetoursRatpPage = lazy(() => import("./pages/RetoursRatpPage").then((m) => ({ default: m.RetoursRatpPage })));
const KpiPage = lazy(() => import("./pages/KpiPage").then((m) => ({ default: m.KpiPage })));
const RapportsPage = lazy(() => import("./pages/RapportsPage").then((m) => ({ default: m.RapportsPage })));
const VerrouillagePage = lazy(() => import("./pages/VerrouillagePage").then((m) => ({ default: m.VerrouillagePage })));

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    padding: "14px 24px",
    backgroundColor: "#1B365D",
    color: "#fff",
  },
  brand: { display: "flex", flexDirection: "column", gap: "2px" },
  headerText: { color: "#fff" },
  headerSub: { color: "rgba(255,255,255,0.82)", fontSize: "13px" },
  nav: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: "0 12px",
    overflowX: "auto",
    display: "flex",
    gap: "4px",
  },
  navLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 12px",
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
    textDecoration: "none",
    borderBottom: "2px solid transparent",
    whiteSpace: "nowrap",
  },
  navActive: {
    color: "#1B365D",
    fontWeight: 600,
    borderBottomColor: "#1B365D",
  },
  main: {
    flex: 1,
    padding: "20px 24px 40px",
    maxWidth: "1280px",
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  footer: {
    padding: "12px 24px",
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

interface Meta {
  projectName: string;
  version: string;
  inspiredBy: string;
  lock: { locked: number; message: string | null };
}

const NAV: Array<{ to: string; label: string; icon: ReactNode; end?: boolean }> = [
  { to: "/", label: "Accueil", icon: <HomeRegular />, end: true },
  { to: "/documents", label: "Documents", icon: <DocumentRegular /> },
  { to: "/import-ppd", label: "Import PPD", icon: <ArrowUploadRegular /> },
  { to: "/export-ppd", label: "Export PPD", icon: <ArrowDownloadRegular /> },
  { to: "/bordereaux", label: "Bordereaux", icon: <BoxRegular /> },
  { to: "/lookups", label: "Référentiels", icon: <DatabaseRegular /> },
  { to: "/revisions", label: "Révisions", icon: <ArrowSyncRegular /> },
  { to: "/retours-ratp", label: "Retours RATP", icon: <ClipboardTaskRegular /> },
  { to: "/kpi", label: "KPI / bilans", icon: <ChartMultipleRegular /> },
  { to: "/rapports", label: "Rapports", icon: <HistoryRegular /> },
  { to: "/verrouillage", label: "Verrouillage", icon: <LockClosedRegular /> },
];

export function App() {
  const s = useStyles();
  const loc = useLocation();
  const [meta, setMeta] = useState<Meta | null>(null);

  useLayoutEffect(() => {
    hideBootSplash();
  }, []);

  useEffect(() => {
    api.get<Meta>("/api/meta").then(setMeta).catch(() => undefined);
  }, [loc.pathname]);

  return (
    <ToastHost>
      <div className={s.root}>
        <header className={s.header}>
          <div className={s.brand}>
            <Title3 className={s.headerText}>{meta?.projectName ?? "MI20 Arbo"}</Title3>
            <span className={s.headerSub}>Plan de production documentaire · bordereaux · IHM 1.6.6</span>
          </div>
          <Text className={s.headerText}>v{meta?.version ?? "1.0.0"}</Text>
        </header>
        {import.meta.env.VITE_STATIC_DEMO === "true" ? (
          <MessageBar intent="info">
            <MessageBarBody>
              <MessageBarTitle>Démo publique temporaire</MessageBarTitle>
              Données synthétiques dans le navigateur — pas Entra, pas SharePoint. Production :{" "}
              <a href="https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc">BT_BTPIIMaroc-GestionDoc</a>.
              Si l&apos;accueil est vide, blanc, ou l&apos;ancien écran de landing : <b>Ctrl+Maj+R</b> (hard refresh) pour
              ignorer le cache du navigateur.
            </MessageBarBody>
          </MessageBar>
        ) : null}
        {meta?.lock?.locked ? (
          <MessageBar intent="warning">
            <MessageBarBody>
              <MessageBarTitle>Base verrouillée</MessageBarTitle>
              {meta.lock.message || "Form_VerrouillageBase — les mises à jour sont suspendues."}
            </MessageBarBody>
          </MessageBar>
        ) : null}
        <nav className={s.nav} aria-label="Modules">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${s.navLink} ${isActive ? s.navActive : ""}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className={s.main}>
          <Suspense fallback={<Loading label="Chargement du module…" />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:id" element={<DocumentEditPage />} />
              <Route path="/import-ppd" element={<ImportPpdPage />} />
              <Route path="/import-ppd/:batchId" element={<ImportPpdPage />} />
              <Route path="/export-ppd" element={<ExportPpdPage />} />
              <Route path="/bordereaux" element={<BordereauxPage />} />
              <Route path="/bordereaux/:id" element={<BordereauDetailPage />} />
              <Route path="/lookups" element={<LookupsPage />} />
              <Route path="/revisions" element={<RevisionsPage />} />
              <Route path="/retours-ratp" element={<RetoursRatpPage />} />
              <Route path="/kpi" element={<KpiPage />} />
              <Route path="/rapports" element={<RapportsPage />} />
              <Route path="/verrouillage" element={<VerrouillagePage onChange={() => api.get<Meta>("/api/meta").then(setMeta)} />} />
            </Routes>
          </Suspense>
        </main>
        <footer className={s.footer}>
          Outil interne MI20 Arbo — inspiré de l&apos;IHM Access BASE ARBO 1.6.6. Données de démo synthétiques. Modules :
          docs/handoff (pas Form_ARCHI).
        </footer>
      </div>
    </ToastHost>
  );
}
