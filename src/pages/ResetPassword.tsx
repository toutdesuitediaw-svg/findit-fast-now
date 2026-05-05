import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase recovery links produce a session via onAuthStateChange (PASSWORD_RECOVERY)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a] text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full border border-[#d4af37]/60 bg-black/60 flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#d4af37]" />
          </div>
          <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
        </div>

        {!ready ? (
          <p className="text-sm text-white/60">
            Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-white/80">Nouveau mot de passe</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-white/80">Confirmer</Label>
              <Input
                type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                placeholder="••••••••"
                required
              />
            </div>
            <Button
              type="submit" disabled={busy}
              className="w-full h-11 bg-gradient-to-r from-[#d4af37] to-[#b8941f] text-black font-semibold"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mettre à jour"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
