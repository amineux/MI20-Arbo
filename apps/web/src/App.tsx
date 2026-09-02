import {
  Body1,
  Button,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Tab,
  TabList,
  Text,
  tokens,
  Title3,
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
import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import { HomePage } from "./pages/HomePage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DocumentEditPage } from "./pages/DocumentEditPage";
import { ImportPpdPage } from "./pages/ImportPpdPage";
import { ExportPpdPage } from "./pages/ExportPpdPage";
import { BordereauxPage } from "./pages/BordereauxPage";
import { BordereauDetailPage } from "./pages/BordereauDetailPage";
import { LookupsPage } from "./pages/LookupsPage";
import { StubPage } from "./pages/StubPage";

const useStyles = makeStyles({
  root: { minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground2 },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  headerText: { color: tokens.colorNeutralForegroundOnBrand },
  nav: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: "0 8px",
    overflowX: "auto",
  },
  main: { flex: 1, padding: "16px 20px 32px", maxWidth: "1400px", width: "100%", margin: "0 auto", boxSizing: "border-box" },
  footer: { padding: "8px 20px", color: tokens.colorNeutralForeground3, fontSize: "12px" },
});

interface Meta {
  projectName: string;
  version: string;
  inspiredBy: string;
  lock: { locked: number; message: string | null };
}

const NAV = [
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
  const nav = useNavigate();
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    api.get<Meta>("/api/meta").then(setMeta).catch(() => undefined);
  }, [loc.pathname]);

  const selected = NAV.find((n) => (n.end ? loc.pathname === "/" : loc.pathname.startsWith(n.to)))?.to ?? "/";

  return (
    <div className={s.root}>
      <header className={s.header}>
        <div>
          <Title3 className={s.headerText}>{meta?.projectName ?? "MI20 Arbo"}</Title3>
          <Body1 className={s.headerText}> Plan de production documentaire · bordereau</Body1>
        </div>
        <Text className={s.headerText}>v{meta?.version ?? "1.0.0"}</Text>
      </header>
      {meta?.lock?.locked ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>Base verrouillée</MessageBarTitle>
            {meta.lock.message || "Form_VerrouillageBase — les mises à jour sont suspendues."}
          </MessageBarBody>
        </MessageBar>
      ) : null}
      <nav className={s.nav}>
        <TabList
          selectedValue={selected}
          size="small"
          onTabSelect={(_, d) => {
            if (typeof d.value === "string") nav(d.value);
          }}
        >
          {NAV.map((item) => (
            <Tab key={item.to} icon={item.icon} value={item.to}>
              {item.label}
            </Tab>
          ))}
        </TabList>
      </nav>
      <main className={s.main}>
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
          <Route
            path="/revisions"
            element={
              <StubPage
                title="Révisions"
                form="Form_CREATE_REV"
                detail="Création d'indice de révision lié à programmation_jalon. Prévu phase suivante."
              />
            }
          />
          <Route
            path="/retours-ratp"
            element={
              <StubPage
                title="Retours RATP / fiche avis"
                form="Form_SaisieRetoursRATP"
                detail="Saisie des retours, fichiers FA sur revision, ImportRetoursRATP."
              />
            }
          />
          <Route
            path="/kpi"
            element={
              <StubPage
                title="KPI / bilan envois / documents d'autorisation"
                form="Form_EXPORT"
                detail="Templates officiels sous fixtures/ : KPI1_Template.xlsm, BilanEnvois_Template.xlsx, DoctsAutorisation_Template.xlsx (GET /api/templates). Export métier à brancher."
              />
            }
          />
          <Route
            path="/rapports"
            element={
              <StubPage
                title="Rapports / audit"
                form="Form_REPORT"
                detail="Journal doc_histo (historique champ à champ). Un extrait est déjà alimenté après import/édition."
              />
            }
          />
          <Route path="/verrouillage" element={<LockPage onChange={() => api.get<Meta>("/api/meta").then(setMeta)} />} />
        </Routes>
      </main>
      <footer className={s.footer}>
        Outil interne MI20 Arbo — inspiré de l&apos;IHM Access 1.6.6. Données de démo synthétiques, sans branding
        constructeur.
      </footer>
    </div>
  );
}

function LockPage({ onChange }: { onChange: () => void }) {
  const [lock, setLock] = useState<{ locked: number; message: string | null } | null>(null);
  useEffect(() => {
    api.get<{ locked: number; message: string | null }>("/api/lock").then(setLock);
  }, []);
  return (
    <div>
      <Title3>Verrouillage de la base</Title3>
      <Body1>
        Équivalent Form_VerrouillageBase. Bannière globale lorsque la base est verrouillée. La saisie métier des
        règles de verrou (import en cours, etc.) sera enrichie ensuite.
      </Body1>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Button
          appearance="primary"
          onClick={async () => {
            await api.post("/api/lock", { locked: true, message: "Base verrouillée pour maintenance (démo)." });
            setLock(await api.get("/api/lock"));
            onChange();
          }}
        >
          Verrouiller
        </Button>
        <Button
          onClick={async () => {
            await api.post("/api/lock", { locked: false, message: null });
            setLock(await api.get("/api/lock"));
            onChange();
          }}
        >
          Déverrouiller
        </Button>
      </div>
      <pre style={{ marginTop: 16 }}>{JSON.stringify(lock, null, 2)}</pre>
    </div>
  );
}
