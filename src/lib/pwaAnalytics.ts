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

export async function trackPwaEvent(eventType: PwaEventType) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("pwa_install_events").insert({
      event_type: eventType,
      platform: detectPlatform(),
      user_agent: navigator.userAgent.slice(0, 500),
      referrer: document.referrer.slice(0, 500) || null,
      user_id: user?.id ?? null,
    });
  } catch (err) {
    // Silent fail — analytics must never block UX
    console.debug("pwa analytics", err);
  }
}
