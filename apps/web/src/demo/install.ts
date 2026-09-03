/** Lightweight fetch patch. Handlers (and SheetJS via @mi20/domain) load on first /api call. */
export function isStaticDemo(): boolean {
  return import.meta.env.VITE_STATIC_DEMO === "true";
}

function apiUrl(input: RequestInfo | URL): URL | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    let path = url.pathname;
    if (path.startsWith("/MI20-Arbo/")) path = path.slice("/MI20-Arbo".length);
    else if (path === "/MI20-Arbo") path = "/";
    if (path === "/api" || path.startsWith("/api/")) {
      url.pathname = path;
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export function installStaticDemo(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __mi20Demo?: boolean; __mi20OrigFetch?: typeof fetch };
  if (w.__mi20Demo) return;
  w.__mi20Demo = true;
  const orig = window.fetch.bind(window);
  w.__mi20OrigFetch = orig;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = apiUrl(input);
    if (!url) return orig(input, init);
    const { DemoHttpError, handleDemoApi } = await import("./handlers");
    try {
      return await handleDemoApi(url, init);
    } catch (err) {
      if (err instanceof DemoHttpError) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: err.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/** GitHub Pages 404s on /MI20-Arbo/documents — map to hash routes. */
export function rewritePathToHash(): void {
  if (!isStaticDemo()) return;
  const base = "/MI20-Arbo";
  const path = window.location.pathname;
  if (!path.startsWith(base)) return;
  const rest = path.slice(base.length) || "/";
  if (rest !== "/" && !window.location.hash) {
    const hash = `#${rest.startsWith("/") ? rest : `/${rest}`}${window.location.search}`;
    window.location.replace(`${base}/${hash}`);
  }
}
