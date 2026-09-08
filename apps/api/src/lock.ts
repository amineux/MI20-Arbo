/** Default Access-style lock copy when `app_lock.message` is empty. */
export const BASE_LOCKED_MESSAGE = "Base verrouillée — les mises à jour sont suspendues.";

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

/** Strip query string and trailing slashes (same as the Pages demo intercept). */
export function apiPathname(url: string): string {
  return (url.split("?")[0] ?? "/").replace(/\/+$/, "") || "/";
}

/**
 * Writes that stay allowed while the base is locked.
 * Matches the GitHub Pages demo intercept so lock/unlock and read-like exports still work.
 */
export function isLockExemptWrite(pathname: string): boolean {
  if (pathname === "/api/lock") return true;
  if (pathname === "/api/exports/ppd") return true;
  if (
    pathname === "/api/exports/kpi" ||
    pathname === "/api/exports/kpi1" ||
    pathname === "/api/exports/bilan-envois" ||
    pathname === "/api/exports/bilan" ||
    pathname === "/api/exports/docts-autorisation" ||
    pathname === "/api/exports/docts"
  ) {
    return true;
  }
  return pathname.endsWith("/compare.xlsx");
}

export function isAppLocked(locked: unknown): boolean {
  return locked === true || locked === 1 || locked === "1";
}

export function lockRefusalMessage(message: string | null | undefined): string {
  const custom = typeof message === "string" ? message.trim() : "";
  return custom || BASE_LOCKED_MESSAGE;
}
