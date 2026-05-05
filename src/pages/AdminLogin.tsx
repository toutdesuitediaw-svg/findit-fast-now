import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldAlert, Loader2, Mail, KeyRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const emailSchema = z.string().trim().email("Email invalide").max(255);
const passwordSchema = z.string().min(6, "Au moins 6 caractères").max(72);

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const STORAGE_KEY = "admin_login_attempts";

type AttemptState = { count: number; lockedUntil: number | null };

function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: null };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: null };
  }
}
function writeAttempts(s: AttemptState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const bootstrapped = useRef(false);

  // Ensure default admin exists; function is idempotent when already configured.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        await supabase.functions.invoke("bootstrap-admin", {
          body: {},
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const s = readAttempts();
    if (s.lockedUntil && s.lockedUntil > Date.now()) setLockedUntil(s.lockedUntil);
  }, []);

  // If already logged in as admin, go to /admin; if logged in but not admin, sign out.
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (data) navigate("/admin", { replace: true });
    })();
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && lockedUntil > Date.now()) {
      const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
      toast.error(`Trop de tentatives. Réessayez dans ${mins} min.`);
      return;
    }
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }

    setBusy(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !signIn.user) {
      const s = readAttempts();
      const count = s.count + 1;
      const next: AttemptState =
        count >= MAX_ATTEMPTS
          ? { count: 0, lockedUntil: Date.now() + LOCK_MS }
          : { count, lockedUntil: null };
      writeAttempts(next);
      if (next.lockedUntil) setLockedUntil(next.lockedUntil);
      toast.error("Identifiants invalides");
      setBusy(false);
      return;
    }

    // Verify admin role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", signIn.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      toast.error("Accès refusé : compte non administrateur");
      setBusy(false);
      return;
    }

    // Reset attempts and log admin login
    writeAttempts({ count: 0, lockedUntil: null });
    await supabase.from("activity_logs").insert([{
      admin_id: signIn.user.id,
      action: "admin_login",
      target_type: "auth",
      metadata: { at: new Date().toISOString(), ua: navigator.userAgent } as never,
    }]);
    toast.success("Connexion administrateur réussie");
    navigate("/admin", { replace: true });
  };

  const submitForgot = async () => {
    try {
      emailSchema.parse(forgotEmail);
    } catch {
      return toast.error("Email invalide");
    }
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Si ce compte existe, un email de réinitialisation a été envoyé.");
    setForgotOpen(false);
    setForgotEmail("");
  };

  const isLocked = !!(lockedUntil && lockedUntil > Date.now());

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 bg-[#0a0a0a] text-white overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative w-full max-w-md">
        {/* Header lock */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#d4af37]/30 blur-xl animate-pulse" />
            <div className="relative w-12 h-12 rounded-full border border-[#d4af37]/60 bg-black/60 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.5)]">
              <Lock className="w-5 h-5 text-[#d4af37]" />
            </div>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.3em] text-[#d4af37]/80 uppercase">Tout Suite Annonces</p>
            <h1 className="text-lg font-semibold text-white">Compte administrateur</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-8 shadow-[0_0_40px_rgba(212,175,55,0.08)]">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Connexion sécurisée</h2>
            <p className="mt-1 text-sm text-white/50">Accès réservé aux administrateurs.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80 text-xs uppercase tracking-wider">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={busy || isLocked}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-[#d4af37]/40"
                  placeholder="admin@exemple.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80 text-xs uppercase tracking-wider">Mot de passe</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy || isLocked}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-[#d4af37]/40"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy || isLocked}
              className="w-full h-11 bg-gradient-to-r from-[#d4af37] to-[#b8941f] hover:from-[#e5c04a] hover:to-[#c9a428] text-black font-semibold shadow-[0_0_20px_rgba(212,175,55,0.35)]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
            </Button>

            <div className="text-right">
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                className="text-xs text-[#d4af37]/80 hover:text-[#d4af37] underline-offset-4 hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {isLocked && (
              <p className="text-center text-xs text-red-400">
                Compte temporairement verrouillé. Réessayez plus tard.
              </p>
            )}
          </form>

          <div className="mt-6 flex items-start gap-2 text-xs text-white/40 border-t border-white/5 pt-4">
            <ShieldAlert className="w-4 h-4 text-[#d4af37]/70 mt-0.5 shrink-0" />
            <p>
              Les tentatives de connexion sont journalisées. Toute utilisation non
              autorisée est strictement interdite.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Vous êtes utilisateur ?{" "}
          <button
            onClick={() => navigate("/auth")}
            className="text-[#d4af37]/80 hover:text-[#d4af37] underline-offset-4 hover:underline"
          >
            Connexion classique
          </button>
        </p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Entrez votre email administrateur. Vous recevrez un lien pour définir un nouveau mot de passe.
            </p>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email" type="email" autoComplete="email"
                value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="admin@exemple.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForgotOpen(false)}>Annuler</Button>
            <Button onClick={submitForgot} disabled={forgotBusy}>
              {forgotBusy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Envoyer le lien
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLogin;
