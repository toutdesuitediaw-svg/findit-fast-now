import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: secretRow } = await admin.from("site_settings").select("value").eq("key", "lifecycle_hook").maybeSingle();
    const expectedSecret = (secretRow?.value as any)?.secret as string | undefined;
    const provided = req.headers.get("x-cron-secret");
    if (!expectedSecret || provided !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
    const archiveCutoff = new Date(now.getTime() - 90 * 86400000).toISOString();

    // 1) Notify 30d before expiry
    const { data: expiring30 } = await admin.from("listings")
      .select("id, user_id, title, expires_at")
      .eq("is_active", true).eq("expiry_notified_30d", false)
      .lte("expires_at", in30).gt("expires_at", in7).limit(500);

    for (const l of expiring30 ?? []) {
      await admin.from("moderation_notifications").insert({
        user_id: l.user_id, type: "expiry_30d",
        title: "Votre annonce expirera bientôt",
        body: `« ${l.title} » expirera le ${new Date(l.expires_at).toLocaleDateString("fr-FR")}. Renouvelez-la pour la garder en ligne.`,
        metadata: { listing_id: l.id },
      });
      await admin.from("listings").update({ expiry_notified_30d: true }).eq("id", l.id);
    }

    // 2) Notify 7d
    const { data: expiring7 } = await admin.from("listings")
      .select("id, user_id, title, expires_at")
      .eq("is_active", true).eq("expiry_notified_7d", false)
      .lte("expires_at", in7).gt("expires_at", now.toISOString()).limit(500);

    for (const l of expiring7 ?? []) {
      await admin.from("moderation_notifications").insert({
        user_id: l.user_id, type: "expiry_7d",
        title: "Dernière semaine avant expiration",
        body: `Votre annonce « ${l.title} » expire le ${new Date(l.expires_at).toLocaleDateString("fr-FR")}.`,
        metadata: { listing_id: l.id },
      });
      await admin.from("listings").update({ expiry_notified_7d: true, expiry_notified_30d: true }).eq("id", l.id);
    }

    // 3) Expire & archive
    const { data: expired } = await admin.from("listings")
      .select("id, user_id, title")
      .eq("is_active", true).is("archived_at", null)
      .lte("expires_at", now.toISOString()).limit(500);

    for (const l of expired ?? []) {
      await admin.from("listings").update({
        is_active: false, archived_at: now.toISOString(),
        expiry_notified_0d: true, expiry_notified_7d: true, expiry_notified_30d: true,
      }).eq("id", l.id);
      await admin.from("moderation_notifications").insert({
        user_id: l.user_id, type: "expiry_0d",
        title: "Votre annonce a expiré",
        body: `« ${l.title} » a expiré et a été archivée. Renouvelez-la pour la remettre en ligne.`,
        metadata: { listing_id: l.id },
      });
    }

    // 4) Permanent delete archived > 90 days
    const { data: deleted } = await admin.from("listings")
      .delete().lt("archived_at", archiveCutoff).select("id");

    return new Response(JSON.stringify({
      notified_30d: expiring30?.length ?? 0,
      notified_7d: expiring7?.length ?? 0,
      expired: expired?.length ?? 0,
      hard_deleted: deleted?.length ?? 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
