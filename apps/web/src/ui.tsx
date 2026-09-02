import {
  Body1,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "16px" },
  lead: { color: tokens.colorNeutralForeground2, maxWidth: "72ch" },
  meta: { color: tokens.colorNeutralForeground3, fontSize: "12px" },
  empty: {
    padding: "32px 20px",
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    textAlign: "center",
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
  form,
  children,
}: {
  title: string;
  form?: string;
  children?: ReactNode;
}) {
  const s = useStyles();
  return (
    <div className={s.page} style={{ gap: 8 }}>
      <Title3>{title}</Title3>
      {form ? <span className={s.meta}>Access · {form} · docs/handoff/TEKKY_BASE_ARBO_HANDOFF.md</span> : null}
      {children ? <Body1 className={s.lead}>{children}</Body1> : null}
    </div>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  const s = useStyles();
  return (
    <div className={s.empty}>
      <Title3>{title}</Title3>
      <Body1 className={s.lead} style={{ margin: "8px auto 0" }}>
        {detail}
      </Body1>
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function Loading({ label = "Chargement" }: { label?: string }) {
  return (
    <div style={{ padding: 24 }}>
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
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5000);
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
