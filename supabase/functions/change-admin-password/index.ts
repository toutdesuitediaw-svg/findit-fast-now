// Sécurité: change le mot de passe de l'admin connecté.
// Exige: JWT valide + rôle admin + ré-authentification (mot de passe actuel).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const userId = claims.claims.sub as string;
    const email = claims.claims.email as string | undefined;
    if (!email) return json({ error: "Email manquant" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Vérifier rôle admin
    const { data: roleRow, error: rErr } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (rErr || !roleRow) return json({ error: "Accès refusé" }, 403);

    // Parser & valider entrée
    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (newPassword.length < 12) return json({ error: "Le nouveau mot de passe doit faire au moins 12 caractères." }, 400);
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return json({ error: "Le mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial." }, 400);
    }
    if (newPassword === currentPassword) return json({ error: "Le nouveau mot de passe doit être différent." }, 400);

    // Ré-authentifier avec le mot de passe actuel
    const verify = createClient(SUPABASE_URL, ANON);
    const { error: signErr } = await verify.auth.signInWithPassword({ email, password: currentPassword });
    if (signErr) return json({ error: "Mot de passe actuel incorrect." }, 401);

    // Mettre à jour le mot de passe
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updErr) return json({ error: updErr.message }, 400);

    // Journaliser
    await admin.from("activity_logs").insert({
      admin_id: userId,
      action: "admin.password_changed",
      target_type: "user",
      target_id: userId,
      metadata: {},
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
