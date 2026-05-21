import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost = typeof window !== "undefined" && (
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app")
);

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const pushBlocked = () => isInIframe; // preview iframe blocks SW reliably

let cachedRegistration: ServiceWorkerRegistration | null = null;

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || pushBlocked()) return null;
  if (cachedRegistration) return cachedRegistration;
  try {
    cachedRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return cachedRegistration;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

async function fetchPublicKey(): Promise<string | null> {
  const { data } = await supabase
    .from("site_settings").select("value").eq("key", "vapid_public_key").maybeSingle();
  return (data?.value as any)?.key ?? null;
}

export async function getPushPermissionState(): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported() || pushBlocked()) return "unsupported";
  return Notification.permission;
}

export async function isSubscribed(): Promise<boolean> {
  const reg = await ensureRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "Push non supporté sur cet appareil" };
  if (pushBlocked()) return { ok: false, reason: "Push indisponible dans l'aperçu — testez sur le site publié" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Vous devez être connecté" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Permission refusée" };

  const reg = await ensureRegistration();
  if (!reg) return { ok: false, reason: "Service worker indisponible" };

  const publicKey = await fetchPublicKey();
  if (!publicKey) return { ok: false, reason: "Clé VAPID indisponible" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = (json.keys as any)?.p256dh;
  const auth = (json.keys as any)?.auth;
  if (!endpoint || !p256dh || !auth) return { ok: false, reason: "Abonnement invalide" };

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id, endpoint, p256dh, auth, user_agent: navigator.userAgent.slice(0, 500),
  }, { onConflict: "endpoint" });

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function unsubscribePush(): Promise<boolean> {
  const reg = await ensureRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return true;
}
