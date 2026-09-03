import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
  makeStyles,
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
  MoreHorizontalRegular,
} from "@fluentui/react-icons";
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
  chrome: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    backdropFilter: "saturate(180%) blur(20px)",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    padding: "16px 28px 8px",
  },
  brand: { display: "flex", flexDirection: "column", gap: "2px" },
  mark: {
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#1B365D",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    lineHeight: "1.15",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#1d1d1f",
  },
  headerSub: {
    color: tokens.colorNeutralForeground3,
    fontSize: "13px",
  },
  version: {
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
  },
  nav: {
    padding: "8px 20px 12px",
    display: "flex",
    gap: "4px",
    overflowX: "auto",
    alignItems: "center",
  },
  navLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
    textDecoration: "none",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    border: "1px solid transparent",
  },
  navActive: {
    color: "#1B365D",
    fontWeight: 600,
    backgroundColor: "rgba(27, 54, 93, 0.08)",
    border: "1px solid rgba(27, 54, 93, 0.10)",
  },
  moreBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
    background: "transparent",
    borderRadius: "999px",
    border: "1px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  moreActive: {
    color: "#1B365D",
    fontWeight: 600,
    backgroundColor: "rgba(27, 54, 93, 0.08)",
    border: "1px solid rgba(27, 54, 93, 0.10)",
  },
  main: {
    flex: 1,
    padding: "36px 28px 64px",
    maxWidth: "1120px",
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  footer: {
    padding: "20px 28px 28px",
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
    textAlign: "center",
  },
  lockWrap: {
    maxWidth: "1120px",
    margin: "0 auto",
    padding: "12px 28px 0",
    boxSizing: "border-box",
    width: "100%",
  },
});

interface Meta {
  projectName: string;
  version: string;
  inspiredBy: string;
  lock: { locked: number; message: string | null };
}

const PRIMARY: Array<{ to: string; label: string; icon: ReactNode; end?: boolean }> = [
  { to: "/", label: "Accueil", icon: <HomeRegular />, end: true },
  { to: "/documents", label: "Documents", icon: <DocumentRegular /> },
  { to: "/import-ppd", label: "Import PPD", icon: <ArrowUploadRegular /> },
  { to: "/bordereaux", label: "Bordereaux", icon: <BoxRegular /> },
  { to: "/retours-ratp", label: "Retours RATP", icon: <ClipboardTaskRegular /> },
];

const MORE: Array<{ to: string; label: string; icon: ReactNode }> = [
  { to: "/export-ppd", label: "Export PPD", icon: <ArrowDownloadRegular /> },
  { to: "/lookups", label: "Référentiels", icon: <DatabaseRegular /> },
  { to: "/revisions", label: "Révisions", icon: <ArrowSyncRegular /> },
  { to: "/kpi", label: "KPI / bilans", icon: <ChartMultipleRegular /> },
  { to: "/rapports", label: "Rapports", icon: <HistoryRegular /> },
  { to: "/verrouillage", label: "Verrouillage", icon: <LockClosedRegular /> },
];

function pathMatches(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function App() {
  const s = useStyles();
  const loc = useLocation();
  const nav = useNavigate();
  const [meta, setMeta] = useState<Meta | null>(null);
  const moreActive = MORE.some((item) => pathMatches(loc.pathname, item.to));

  useLayoutEffect(() => {
    hideBootSplash();
  }, []);

  useEffect(() => {
    api.get<Meta>("/api/meta").then(setMeta).catch(() => undefined);
  }, [loc.pathname]);

  return (
    <ToastHost>
      <div className={s.root}>
        <div className={s.chrome}>
          <header className={s.header}>
            <div className={s.brand}>
              <span className={s.mark}>MI20</span>
              <h1 className={s.title}>{meta?.projectName ?? "MI20 Arbo"}</h1>
              <span className={s.headerSub}>
                Plan de production documentaire · bordereaux · fiches d&apos;avis
                {import.meta.env.VITE_STATIC_DEMO === "true" ? " · enregistré dans ce navigateur" : ""}
              </span>
            </div>
            <Text className={s.version}>v{meta?.version ?? "1.1.0"}</Text>
          </header>
          <nav className={s.nav} aria-label="Modules">
            {PRIMARY.map((item) => (
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
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <button type="button" className={`${s.moreBtn} ${moreActive ? s.moreActive : ""}`} aria-label="Plus de modules">
                  <MoreHorizontalRegular />
                  Plus
                </button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {MORE.map((item) => (
                    <MenuItem key={item.to} onClick={() => nav(item.to)}>
                      {item.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          </nav>
        </div>
        {meta?.lock?.locked ? (
          <div className={s.lockWrap}>
            <MessageBar intent="warning">
              <MessageBarBody>
                <MessageBarTitle>Base verrouillée</MessageBarTitle>
                {meta.lock.message || "Les mises à jour sont suspendues."}
              </MessageBarBody>
            </MessageBar>
          </div>
        ) : null}
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
        <footer className={s.footer}>MI20 Arbo</footer>
      </div>
    </ToastHost>
  );
}
