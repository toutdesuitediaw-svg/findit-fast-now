import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-moderation-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ModerationVerdict {
  trust_score: number;
  severity: "low" | "medium" | "high" | "critical";
  recommended_action: "keep" | "quarantine" | "remove";
  categories: string[];
  reasons: string[];
  vendor_risk: number;
  confidence: number;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function callAI(payload: {
  title: string;
  description: string;
  imageUrls: string[];
  vendor: { account_age_days: number; listings_count: number; past_valid_reports: number; status: string };
}): Promise<ModerationVerdict> {
  const sys = `Tu es un modérateur expert pour une marketplace francophone (Sénégal). Analyse l'annonce (texte + images + contexte vendeur) et détecte: arnaques, faux produits, spam, contenu adulte, armes, drogues, contenu volé, violence, escroqueries, prix anormalement bas. Réponds UNIQUEMENT via l'outil moderation_verdict. Le trust_score est entre 0 (dangereux) et 100 (fiable). Sois prudent: en cas de doute, recommande quarantine.`;

  const userContent: any[] = [
    {
      type: "text",
      text: `Titre: ${payload.title}\n\nDescription: ${payload.description}\n\nVendeur: compte de ${payload.vendor.account_age_days} jours, ${payload.vendor.listings_count} annonces, ${payload.vendor.past_valid_reports} signalements validés passés, statut: ${payload.vendor.status}.`,
    },
    ...payload.imageUrls.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userContent },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "moderation_verdict",
          description: "Verdict de modération structuré",
          parameters: {
            type: "object",
            properties: {
              trust_score: { type: "integer", minimum: 0, maximum: 100 },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              recommended_action: { type: "string", enum: ["keep", "quarantine", "remove"] },
              categories: { type: "array", items: { type: "string" } },
              reasons: { type: "array", items: { type: "string" } },
              vendor_risk: { type: "integer", minimum: 0, maximum: 100 },
              confidence: { type: "integer", minimum: 0, maximum: 100 },
            },
            required: ["trust_score", "severity", "recommended_action", "categories", "reasons", "vendor_risk", "confidence"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "moderation_verdict" } },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) throw new Error("No tool call returned");
  const verdict = JSON.parse(tc.function.arguments) as ModerationVerdict;
  return verdict;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validate secret
    const { data: settingRow } = await admin.from("site_settings").select("value").eq("key", "moderation_hook").maybeSingle();
    const expectedSecret = (settingRow?.value as any)?.secret as string | undefined;
    const provided = req.headers.get("x-moderation-secret");

    // Allow either: matching secret OR an admin JWT
    let isAuthorized = false;
    if (expectedSecret && provided && provided === expectedSecret) {
      isAuthorized = true;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await userClient.auth.getUser();
        if (userData.user) {
          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (roleRow) isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { case_id, listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load listing
    const { data: listing, error: lErr } = await admin
      .from("listings")
      .select("id, user_id, title, description, images")
      .eq("id", listing_id)
      .maybeSingle();
    if (lErr || !listing) throw new Error(lErr?.message || "Listing not found");

    // Vendor context
    const { data: profile } = await admin
      .from("profiles")
      .select("status, created_at")
      .eq("id", listing.user_id)
      .maybeSingle();

    const { count: listingsCount } = await admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", listing.user_id);

    const { count: pastReports } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "user")
      .eq("target_id", listing.user_id)
      .eq("is_valid", true);

    const accountAgeDays = profile?.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
      : 0;

    // Find or upsert case
    let caseId = case_id;
    if (!caseId) {
      const { data: caseRow } = await admin
        .from("moderation_cases")
        .upsert(
          { listing_id: listing.id, user_id: listing.user_id, status: "pending", reports_count: 0 },
          { onConflict: "listing_id" },
        )
        .select("id")
        .single();
      caseId = caseRow!.id;
    }

    // Call AI
    let verdict: ModerationVerdict;
    try {
      verdict = await callAI({
        title: listing.title,
        description: listing.description,
        imageUrls: (listing.images as string[]) || [],
        vendor: {
          account_age_days: accountAgeDays,
          listings_count: listingsCount || 0,
          past_valid_reports: pastReports || 0,
          status: profile?.status || "unknown",
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
      await admin
        .from("moderation_cases")
        .update({ ai_verdict: { error: msg }, status: "pending" })
        .eq("id", caseId);
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Behaviour score (0-100, higher = safer)
    let behavior = 70;
    if (accountAgeDays < 3) behavior -= 25;
    else if (accountAgeDays < 14) behavior -= 10;
    if ((pastReports || 0) >= 3) behavior -= 30;
    else if ((pastReports || 0) >= 1) behavior -= 15;
    if (profile?.status === "suspended" || profile?.status === "banned") behavior -= 40;
    behavior = clamp(behavior, 0, 100);

    // Load configurable thresholds
    const { data: cfgRow } = await admin.from("site_settings").select("value").eq("key", "moderation_config").maybeSingle();
    const cfg = (cfgRow?.value as any) || {};
    const aiW = typeof cfg.ai_weight === "number" ? cfg.ai_weight : 0.7;
    const behW = typeof cfg.behavior_weight === "number" ? cfg.behavior_weight : 0.3;
    const removeBelow = typeof cfg.auto_remove_below === "number" ? cfg.auto_remove_below : 25;
    const quarantineBelow = typeof cfg.quarantine_below === "number" ? cfg.quarantine_below : 55;

    const finalScore = Math.round(aiW * verdict.trust_score + behW * behavior);

    // Decide
    let newStatus: "removed" | "quarantined" | "cleared" = "cleared";
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    let listingPatch: Record<string, unknown> = {};

    if (verdict.severity === "critical" || finalScore < removeBelow || verdict.recommended_action === "remove") {
      newStatus = "removed";
      riskLevel = "critical";
      listingPatch = { is_active: false, auto_removed: true, quarantined_at: new Date().toISOString(), trust_score: finalScore };
    } else if (finalScore < quarantineBelow || verdict.recommended_action === "quarantine") {
      newStatus = "quarantined";
      riskLevel = finalScore < 40 ? "high" : "medium";
      listingPatch = { is_active: false, quarantined_at: new Date().toISOString(), trust_score: finalScore };
    } else {
      newStatus = "cleared";
      riskLevel = finalScore < 75 ? "medium" : "low";
      listingPatch = { trust_score: finalScore };
    }

    await admin.from("listings").update(listingPatch).eq("id", listing.id);

    await admin
      .from("moderation_cases")
      .update({
        status: newStatus,
        trust_score: finalScore,
        risk_level: riskLevel,
        ai_verdict: verdict as any,
        auto_action: newStatus,
        resolved_at: newStatus === "cleared" ? null : new Date().toISOString(),
      })
      .eq("id", caseId);

    // Notify vendor
    const vendorTitle =
      newStatus === "removed"
        ? "Votre annonce a été supprimée"
        : newStatus === "quarantined"
          ? "Votre annonce est en quarantaine"
          : "Votre annonce a été vérifiée";
    const vendorBody =
      newStatus === "cleared"
        ? "Notre IA a vérifié votre annonce après plusieurs signalements et l'a jugée conforme."
        : `Raisons : ${verdict.reasons.slice(0, 3).join(" · ") || "Contenu suspect"}. Vous pouvez contester cette décision depuis votre tableau de bord.`;

    await admin.from("moderation_notifications").insert({
      user_id: listing.user_id,
      case_id: caseId,
      type: `case_${newStatus}`,
      title: vendorTitle,
      body: vendorBody,
      metadata: { trust_score: finalScore, categories: verdict.categories },
    });

    return new Response(
      JSON.stringify({ ok: true, case_id: caseId, status: newStatus, trust_score: finalScore, verdict }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("moderate-listing error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
