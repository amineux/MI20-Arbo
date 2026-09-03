import {
  Body1,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "10px" },
  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: "1.12",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    color: "#1d1d1f",
  },
  lead: { color: tokens.colorNeutralForeground2, maxWidth: "68ch", fontSize: "15px", lineHeight: "1.5" },
  empty: {
    padding: "56px 28px",
    marginTop: "20px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "20px",
    backgroundColor: tokens.colorNeutralBackground1,
    textAlign: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(27, 54, 93, 0.05)",
  },
  emptyTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#1d1d1f",
  },
  toastWrap: {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxWidth: "360px",
  },
});

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const s = useStyles();
  return (
    <div className={s.page}>
      <h1 className={s.title}>{title}</h1>
      {children ? <Body1 className={s.lead}>{children}</Body1> : null}
    </div>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  const s = useStyles();
  return (
    <div className={s.empty}>
      <h2 className={s.emptyTitle}>{title}</h2>
      <Body1 className={s.lead} style={{ margin: "10px auto 0" }}>
        {detail}
      </Body1>
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </div>
  );
}

export function Loading({ label = "Chargement" }: { label?: string }) {
  return (
    <div style={{ padding: 32 }}>
      <Spinner label={label} />
    </div>
  );
}

type ToastIntent = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; intent: ToastIntent; title: string; body?: string };

const ToastCtx = createContext<{
  toast: (intent: ToastIntent, title: string, body?: string) => void;
}>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const s = useStyles();
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((intent: ToastIntent, title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, intent, title, body }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 7000);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className={s.toastWrap}>
        {items.map((t) => (
          <MessageBar key={t.id} intent={t.intent} onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}>
            <MessageBarBody>
              <MessageBarTitle>{t.title}</MessageBarTitle>
              {t.body}
            </MessageBarBody>
          </MessageBar>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
