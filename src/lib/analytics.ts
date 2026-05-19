// Google Analytics 4 (gtag) helper.
// Loads only if VITE_GA_MEASUREMENT_ID env var is set (e.g. "G-XXXXXXXXXX").
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

export const GA_ID: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID as
  | string
  | undefined;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  if (!GA_ID) return;
  initialized = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: true });
}

export function trackEvent(
  name: string,
  params: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", name, params);
  // Always log for debugging in dev
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", name, params);
  }
}

export function trackPageView(path: string) {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", GA_ID, { page_path: path });
}
