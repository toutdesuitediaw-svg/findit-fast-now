// Admin users management: list emails, update profile/email, reset password.
// Caller must be authenticated AND have the 'admin' role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "missing auth" }, 401);

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "invalid token" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return json({ error: error.message }, 500);
      return json({
        users: data.users.map((u) => ({ id: u.id, email: u.email ?? null })),
      });
    }

    if (action === "update") {
      const { userId, display_name, phone, email } = body;
      if (!userId) return json({ error: "userId required" }, 400);

      if (typeof email === "string" && email.length > 0) {
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailOk) return json({ error: "invalid email" }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 400);
      }

      const profilePatch: Record<string, unknown> = {};
      if (typeof display_name === "string") profilePatch.display_name = display_name;
      if (typeof phone === "string") profilePatch.phone = phone;
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await admin.from("profiles").update(profilePatch).eq("id", userId);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ success: true });
    }

    if (action === "reset_password") {
      const { userId, mode, new_password } = body;
      if (!userId) return json({ error: "userId required" }, 400);

      if (mode === "manual") {
        if (typeof new_password !== "string" || new_password.length < 8) {
          return json({ error: "password must be at least 8 characters" }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(userId, { password: new_password });
        if (error) return json({ error: error.message }, 400);
        return json({ success: true, mode: "manual" });
      }

      // Default: send recovery email
      const { data: u } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      if (!email) return json({ error: "user has no email" }, 400);
      const redirectTo = `${new URL(req.url).origin}`;
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, mode: "email" });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      if (userId === callerId) return json({ error: "Vous ne pouvez pas supprimer votre propre compte ici." }, 400);

      // Prevent deleting other admins
      const { data: targetRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (targetRoles) return json({ error: "Impossible de supprimer un autre administrateur." }, 403);

      // Cleanup user storage files recursively (listing photos + avatar + sous-dossiers)
      try {
        const removeFolderRecursive = async (prefix: string) => {
          const { data: entries, error: listErr } = await admin.storage
            .from("listing-photos")
            .list(prefix, { limit: 1000 });
          if (listErr || !entries) return;
          const filePaths: string[] = [];
          for (const entry of entries) {
            const fullPath = `${prefix}/${entry.name}`;
            // Folders have id === null in Supabase storage list responses
            if ((entry as { id: string | null }).id === null) {
              await removeFolderRecursive(fullPath);
            } else {
              filePaths.push(fullPath);
            }
          }
          if (filePaths.length > 0) {
            await admin.storage.from("listing-photos").remove(filePaths);
          }
        };
        await removeFolderRecursive(userId);
      } catch (e) {
        console.error("storage cleanup failed", e);
      }

      // Cleanup user-owned data
      await admin.from("favorites").delete().eq("user_id", userId);
      await admin.from("messages").delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
      await admin.from("listings").delete().eq("user_id", userId);
      await admin.from("transactions").delete().eq("user_id", userId);
      await admin.from("subscriptions").delete().eq("user_id", userId);
      await admin.from("reports").delete().or(`reporter_id.eq.${userId},resolved_by.eq.${userId}`);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);

      // Hard delete (shouldSoftDelete = false) — suppression définitive de l'auth user
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
