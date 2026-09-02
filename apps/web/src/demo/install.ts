import { DemoHttpError, handleDemoApi } from "./handlers";

function apiUrl(input: RequestInfo | URL): URL | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    const path = url.pathname.replace(/^\/MI20-Arbo(?=\/|$)/, "") || "/";
    if (path === "/api" || path.startsWith("/api/")) {
      url.pathname = path;
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Intercept /api fetch so the SPA runs on GitHub Pages without a Node server. */
export function installStaticDemo(): void {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __mi20Demo?: boolean }).__mi20Demo) return;
  (window as unknown as { __mi20Demo: boolean }).__mi20Demo = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = apiUrl(input);
    if (!url) return orig(input, init);
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

export function isStaticDemo(): boolean {
  return import.meta.env.VITE_STATIC_DEMO === "true";
}
