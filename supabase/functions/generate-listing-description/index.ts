// Generates a professional listing description from uploaded photos using Lovable AI (Gemini vision).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  imageUrls: string[];
  categoryName?: string;
  title?: string;
  language?: "fr" | "en";
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
    for (const url of imageUrls) content.push({ type: "image_url", image_url: { url } });

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
      return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans un instant." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des crédits dans Lovable AI." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    if (!args) {
      return new Response(JSON.stringify({ error: "Réponse IA invalide" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (args.refuse) {
      return new Response(JSON.stringify({ error: args.refuse_reason || "Contenu non autorisé." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
