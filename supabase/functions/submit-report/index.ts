import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_MAX_REPORTS_PER_DAY = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { target_type, target_id, reason, details } = body || {};
    if (!target_type || !target_id || !reason) {
      return new Response(JSON.stringify({ error: "target_type, target_id and reason are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Reporter must be active
    const { data: prof } = await admin.from("profiles").select("status, created_at").eq("id", userId).maybeSingle();
    if (!prof || prof.status !== "active") {
      return new Response(JSON.stringify({ error: "Compte inactif, signalement refusé." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configurable rate limit
    const { data: cfgRow } = await admin.from("site_settings").select("value").eq("key", "moderation_config").maybeSingle();
    const maxPerDay = ((cfgRow?.value as any)?.max_reports_per_day as number | undefined) ?? DEFAULT_MAX_REPORTS_PER_DAY;

    // Rate limit per day
    const today = new Date().toISOString().slice(0, 10);
    const { data: rl } = await admin
      .from("report_rate_limits")
      .select("count")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    if ((rl?.count ?? 0) >= maxPerDay) {
      return new Response(JSON.stringify({ error: "Limite quotidienne de signalements atteinte." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-brigade: > 10 reports on same target in last hour from accounts < 2d old → mark new ones invalid
    let isValid = true;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_type", target_type)
      .eq("target_id", target_id)
      .gte("created_at", oneHourAgo);
    const accountAgeDays = prof.created_at
      ? Math.floor((Date.now() - new Date(prof.created_at).getTime()) / 86400000)
      : 0;
    if ((recentCount || 0) > 10 && accountAgeDays < 2) {
      isValid = false;
    }

    // Insert report
    const { data: report, error: rErr } = await admin
      .from("reports")
      .insert({
        reporter_id: userId,
        target_type,
        target_id,
        reason,
        details: details ?? null,
        is_valid: isValid,
      })
      .select("id")
      .single();
    if (rErr) throw rErr;

    // Update rate limit
    await admin
      .from("report_rate_limits")
      .upsert({ user_id: userId, day: today, count: (rl?.count ?? 0) + 1 }, { onConflict: "user_id,day" });

    return new Response(JSON.stringify({ ok: true, report_id: report.id, is_valid: isValid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("submit-report error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
