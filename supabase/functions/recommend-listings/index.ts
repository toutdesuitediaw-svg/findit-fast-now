// Recommends listings using Lovable AI.
// Modes:
//  - similar: given a listing_id, return similar active listings
//  - foryou: given a user_id (optional), return trending/recommended listings
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function rankWithAI(query: string, candidates: any[]): Promise<string[]> {
  if (!candidates.length) return [];
  const compact = candidates.map((c) => ({
    id: c.id, title: c.title, category: c.category_id, location: c.location, price: c.price,
  }));
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You rank classified ads by relevance. Return ONLY a JSON array of listing IDs ordered by relevance, no prose." },
          { role: "user", content: `Context: ${query}\n\nCandidates:\n${JSON.stringify(compact)}\n\nReturn top 8 IDs as JSON array.` },
        ],
      }),
    });
    if (!res.ok) return candidates.slice(0, 8).map((c) => c.id);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return candidates.slice(0, 8).map((c) => c.id);
    const ids = JSON.parse(match[0]);
    return Array.isArray(ids) ? ids.slice(0, 8) : candidates.slice(0, 8).map((c) => c.id);
  } catch {
    return candidates.slice(0, 8).map((c) => c.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { mode, listing_id, user_id } = await req.json();

    if (mode === "similar" && listing_id) {
      const { data: src } = await supabase.from("listings")
        .select("id, title, description, category_id, location, price")
        .eq("id", listing_id).maybeSingle();
      if (!src) return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: candidates } = await supabase.from("listings")
        .select("id, title, category_id, location, price, images, currency, is_premium, is_urgent, created_at")
        .eq("is_active", true)
        .eq("moderation_status", "approved")
        .eq("category_id", src.category_id)
        .neq("id", listing_id)
        .order("created_at", { ascending: false })
        .limit(30);

      const ids = await rankWithAI(
        `Find listings similar to: "${src.title}" in ${src.location ?? "Senegal"} priced near ${src.price ?? "?"}`,
        candidates ?? []
      );
      const ordered = ids.map((id) => (candidates ?? []).find((c) => c.id === id)).filter(Boolean);
      return new Response(JSON.stringify({ items: ordered }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // foryou (or default): premium + trending
    let prefCity: string | null = null;
    let prefCats: string[] = [];
    if (user_id) {
      const { data: pref } = await supabase.from("notification_preferences")
        .select("city, categories").eq("user_id", user_id).maybeSingle();
      prefCity = pref?.city ?? null;
      prefCats = pref?.categories ?? [];
    }

    let q = supabase.from("listings")
      .select("id, title, category_id, location, price, images, currency, is_premium, is_urgent, views_count, created_at")
      .eq("is_active", true).eq("moderation_status", "approved")
      .order("is_premium", { ascending: false })
      .order("views_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    if (prefCats.length) q = q.in("category_id", prefCats);
    if (prefCity) q = q.ilike("location", `%${prefCity}%`);

    const { data: candidates } = await q;
    const ids = await rankWithAI(
      `Recommend the most engaging classified ads for a user${prefCity ? ` in ${prefCity}` : ""}.`,
      candidates ?? []
    );
    const ordered = ids.map((id) => (candidates ?? []).find((c) => c.id === id)).filter(Boolean);
    return new Response(JSON.stringify({ items: ordered }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("recommend-listings error", e);
    return new Response(JSON.stringify({ items: [], error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
