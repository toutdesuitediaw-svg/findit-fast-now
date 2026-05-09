import { supabase } from "@/integrations/supabase/client";

export type PwaEventType =
  | "page_view"
  | "install_click"
  | "install_accepted"
  | "install_dismissed"
  | "app_installed";

const detectPlatform = (): string => {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
};

/**
 * Build a referrer string that also captures UTM parameters when present,
 * so we can segment traffic sources without a schema change.
 * Format examples:
 *   "utm:google/cpc/spring_sale"
 *   "ref:facebook.com"
 *   "" (direct)
 */
const buildReferrer = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("utm_source");
    if (src) {
      const med = params.get("utm_medium") || "-";
      const camp = params.get("utm_campaign") || "-";
      return `utm:${src}/${med}/${camp}`.slice(0, 500);
    }
    if (document.referrer) {
      try {
        const host = new URL(document.referrer).hostname;
        return `ref:${host}`.slice(0, 500);
      } catch {
        return document.referrer.slice(0, 500);
      }
    }
    return null;
  } catch {
    return null;
  }
};

export async function trackPwaEvent(eventType: PwaEventType) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("pwa_install_events").insert({
      event_type: eventType,
      platform: detectPlatform(),
      user_agent: navigator.userAgent.slice(0, 500),
      referrer: buildReferrer(),
      user_id: user?.id ?? null,
    });
  } catch (err) {
    // Silent fail — analytics must never block UX
    console.debug("pwa analytics", err);
  }
}
