// Sends Web Push notifications to all push_subscriptions of a user.
// Triggered by a DB trigger on `notifications` insert.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate secret from the DB trigger
    const { data: hook } = await supabase
      .from("site_settings").select("value").eq("key", "push_hook").maybeSingle();
    const expected = (hook?.value as any)?.secret;
    const provided = req.headers.get("x-push-secret");
    if (!expected || expected !== provided) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, title, body: msgBody, link, type, notification_id } = body ?? {};
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load VAPID keys
    const [{ data: pub }, { data: priv }] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "vapid_public_key").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "vapid_private").maybeSingle(),
    ]);
    const publicKey = (pub?.value as any)?.key;
    const privateKey = (priv?.value as any)?.private_key;
    const subject = (priv?.value as any)?.subject ?? "mailto:contact@toutsuitannonce.com";
    if (!publicKey || !privateKey) {
      return new Response(JSON.stringify({ error: "vapid not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    // Get subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user_id);

    const payload = JSON.stringify({
      title, body: msgBody ?? "", url: link ?? "/", type: type ?? "info", id: notification_id,
    });

    const results = await Promise.allSettled(
      (subs ?? []).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
          payload
        )
      )
    );

    // Cleanup expired subscriptions
    const toDelete: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as any)?.statusCode;
        if (code === 404 || code === 410) toDelete.push((subs ?? [])[i].id);
      }
    });
    if (toDelete.length) {
      await supabase.from("push_subscriptions").delete().in("id", toDelete);
    }

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.status === "fulfilled").length, cleaned: toDelete.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
