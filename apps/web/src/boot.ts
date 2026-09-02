export function hideBootSplash(): void {
  const el = document.getElementById("boot-splash");
  if (!el) return;
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.transition = "opacity 180ms ease";
  window.setTimeout(() => el.remove(), 200);
}
