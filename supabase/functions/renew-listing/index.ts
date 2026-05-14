import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { listing_id } = await req.json().catch(() => ({}));
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: listing } = await admin.from("listings").select("*").eq("id", listing_id).maybeSingle();
    if (!listing) {
      return new Response(JSON.stringify({ error: "Annonce introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (listing.user_id !== u.user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (listing.last_renewed_at && new Date(listing.last_renewed_at).getTime() > Date.now() - 24 * 3600 * 1000) {
      return new Response(JSON.stringify({ error: "Renouvellement déjà effectué dans les dernières 24h" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!listing.is_premium && (listing.renewed_count ?? 0) >= 6) {
      return new Response(JSON.stringify({ error: "Limite annuelle atteinte. Passez en premium pour renouveler davantage." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseExpiry = listing.expires_at && new Date(listing.expires_at) > new Date() ? new Date(listing.expires_at) : new Date();
    const newExpiry = new Date(baseExpiry.getTime() + 365 * 86400000).toISOString();

    const { error: uErr } = await admin.from("listings").update({
      published_at: new Date().toISOString(),
      expires_at: newExpiry,
      archived_at: null,
      is_active: true,
      renewed_count: (listing.renewed_count ?? 0) + 1,
      last_renewed_at: new Date().toISOString(),
      expiry_notified_30d: false,
      expiry_notified_7d: false,
      expiry_notified_0d: false,
      updated_at: new Date().toISOString(),
    }).eq("id", listing_id);
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ ok: true, expires_at: newExpiry }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
