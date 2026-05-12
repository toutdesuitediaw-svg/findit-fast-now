// Generates a professional listing description from uploaded photos using Lovable AI (Gemini vision).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  imageUrls: string[];
  categoryName?: string;
  title?: string;
  language?: "fr" | "en";
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function inspectImage(url: string, lang: "fr" | "en"): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    if (!r.ok) {
      return { ok: false, reason: lang === "en" ? `Unreachable (HTTP ${r.status})` : `Inaccessible (HTTP ${r.status})` };
    }
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      return { ok: false, reason: lang === "en" ? "Not an image" : "Pas une image" };
    }
    const len = parseInt(r.headers.get("content-length") || "0", 10);
    if (len && len > MAX_BYTES) {
      return { ok: false, reason: lang === "en" ? "Too large (>10MB)" : "Trop lourde (>10Mo)" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: lang === "en" ? "Fetch failed" : "Échec de chargement" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { imageUrls, categoryName, title, language = "fr" } = (await req.json()) as Body;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(JSON.stringify({ error: "Au moins une image est requise." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (imageUrls.length > 8) imageUrls.length = 8;

    // Validate each image — keep only the ones we can actually analyze
    const inspections = await Promise.all(imageUrls.map((u) => inspectImage(u, language)));
    const accepted: string[] = [];
    const rejected: { url: string; reason: string }[] = [];
    imageUrls.forEach((u, i) => {
      const r = inspections[i];
      if (r.ok) accepted.push(u);
      else rejected.push({ url: u, reason: r.reason });
    });

    if (accepted.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            language === "en"
              ? "No photo could be analyzed. Check your uploads and try again."
              : "Aucune photo n'a pu être analysée. Vérifiez vos uploads et réessayez.",
          rejected,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    const sys = language === "en"
      ? "You write classified-ad listings for an African marketplace (Toutsuitannonce). Analyze the photos and produce a professional, attractive, SEO-friendly listing in English. Be honest, concrete, and concise. Refuse if content seems illegal, weapons, drugs, adult, counterfeit, or scam — return refuse=true with a short reason."
      : "Tu rédiges des annonces pour une marketplace africaine (Toutsuitannonce). Analyse les photos et produis une annonce professionnelle, attractive et optimisée SEO en français. Sois honnête, concret, naturel, sans spam ni majuscules abusives. Refuse si le contenu paraît illégal, armes, drogues, adulte, contrefaçon ou arnaque — renvoie alors refuse=true avec une raison courte.";

    const userText =
      (language === "en" ? "Category: " : "Catégorie : ") + (categoryName || "?") +
      (title ? `\n${language === "en" ? "User title hint" : "Titre suggéré"}: ${title}` : "") +
      (language === "en"
        ? "\nDetect: object type, brand, color, condition, visible features. Return a catchy title (<= 80 chars) and a 3-5 sentence description."
        : "\nDétecte : type d'objet, marque, couleur, état, caractéristiques visibles. Renvoie un titre accrocheur (<= 80 car.) et une description de 3-5 phrases.");

    const content: any[] = [{ type: "text", text: userText }];
    for (const url of accepted) content.push({ type: "image_url", image_url: { url } });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content },
        ],
        tools: [{
          type: "function",
          function: {
            name: "write_listing",
            description: "Return the generated listing.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                detected: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    brand: { type: "string" },
                    color: { type: "string" },
                    condition: { type: "string" },
                    features: { type: "array", items: { type: "string" } },
                  },
                },
                refuse: { type: "boolean" },
                refuse_reason: { type: "string" },
              },
              required: ["title", "description"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "write_listing" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({
        error: language === "en"
          ? "Too many requests. Please wait a moment and try again."
          : "Trop de requêtes. Patientez un instant puis réessayez.",
        rejected,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({
        error: language === "en"
          ? "AI credits exhausted. Add credits in Lovable AI."
          : "Crédits IA épuisés. Ajoutez des crédits dans Lovable AI.",
        rejected,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({
        error: language === "en"
          ? `AI error (${resp.status}). Please try again.`
          : `Erreur IA (${resp.status}). Veuillez réessayer.`,
        rejected,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    if (!args) {
      return new Response(JSON.stringify({
        error: language === "en" ? "Invalid AI response. Please retry." : "Réponse IA invalide. Réessayez.",
        rejected,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (args.refuse) {
      return new Response(JSON.stringify({
        error: args.refuse_reason || (language === "en" ? "Content not allowed." : "Contenu non autorisé."),
        rejected,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ...args, rejected, analyzed: accepted.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
