// Edge function pour créer le compte admin initial.
// À supprimer après usage.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password, displayName } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email et password requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Vérifier si un admin existe déjà
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ error: "Un administrateur existe déjà. Endpoint désactivé." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Créer l'utilisateur (email pré-confirmé)
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName ?? email.split("@")[0] },
    });

    let userId = created?.user?.id;

    if (createErr) {
      // Si l'utilisateur existe déjà, on le récupère
      if (createErr.message?.toLowerCase().includes("already") || createErr.message?.toLowerCase().includes("registered")) {
        const { data: list } = await supabase.auth.admin.listUsers();
        userId = list.users.find((u) => u.email === email)?.id;
        if (!userId) {
          return new Response(JSON.stringify({ error: createErr.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Attribuer rôle admin
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleErr && !roleErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
