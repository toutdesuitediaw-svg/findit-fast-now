import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { CheckCircle2, Mail, Lock, Loader2, Phone, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { getAuthCallbackUrl, sanitizeAuthRedirect } from "@/lib/authRedirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Logo from "@/components/Logo";

const emailSchema = z.string().trim().email("Email invalide").max(255);
const passwordSchema = z.string().min(6, "Au moins 6 caractères").max(72);
const nameSchema = z.string().trim().min(2, "Au moins 2 caractères").max(80);
const whatsappSchema = z.string().trim().regex(/^\+?[0-9\s-]{8,20}$/, "Numéro WhatsApp invalide");

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = useMemo(() => sanitizeAuthRedirect(searchParams.get("redirect")), [searchParams]);
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">(() => searchParams.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pendingEmail, setPendingEmail] = useState(() => localStorage.getItem("pending-confirmation-email") ?? "");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [user, authLoading, navigate, redirectTo]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (tab === "signup") {
        nameSchema.parse(name);
        whatsappSchema.parse(whatsapp);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }

    setBusy(true);
    if (tab === "signup") {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(redirectTo),
          data: { full_name: name, whatsapp },
        },
      });
      if (error) toast.error(error.message);
      else {
        localStorage.setItem("pending-confirmation-email", normalizedEmail);
        setPendingEmail(normalizedEmail);
        setTab("login");
        toast.success("Email envoyé avec succès", {
          description: "Ouvrez votre boîte de réception puis cliquez sur le lien de confirmation.",
        });
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("email not confirmed") || message.includes("confirm")) {
          const normalizedEmail = email.trim().toLowerCase();
          localStorage.setItem("pending-confirmation-email", normalizedEmail);
          setPendingEmail(normalizedEmail);
          toast.error("Votre email n’est pas encore confirmé.");
        } else {
          toast.error(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
        }
      }
      else {
        // Vérifier le statut du compte
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.status === "banned") {
          await supabase.auth.signOut();
          toast.error("Ce compte a été banni. Accès refusé.");
        } else if (profile?.status === "suspended") {
          await supabase.auth.signOut();
          toast.error("Ce compte est suspendu. Contactez le support.");
        } else {
          localStorage.removeItem("pending-confirmation-email");
          setPendingEmail("");
          toast.success("Bienvenue !");
        }
      }
    }
    setBusy(false);
  };

  const handleResendConfirmation = async () => {
    const targetEmail = (pendingEmail || email).trim().toLowerCase();
    try {
      emailSchema.parse(targetEmail);
    } catch {
      toast.error("Entrez l’email utilisé lors de l’inscription");
      return;
    }

    setResendBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: { emailRedirectTo: getAuthCallbackUrl(redirectTo) },
    });
    setResendBusy(false);

    if (error) return toast.error(error.message);
    localStorage.setItem("pending-confirmation-email", targetEmail);
    setPendingEmail(targetEmail);
    toast.success("Email envoyé avec succès", {
      description: "Si vous ne le voyez pas, vérifiez aussi vos courriers indésirables.",
    });
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectTo}`,
    });
    if (result.error) {
      toast.error("Erreur Google : " + (result.error as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block"><Logo /></div>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-card">
          {pendingEmail && (
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Email envoyé avec succès</p>
                  <p className="mt-1 text-muted-foreground break-words">
                    Confirmez votre adresse <span className="text-foreground">{pendingEmail}</span> avant de vous connecter.
                  </p>
                  <Button
                    type="button"
                    variant="outlineGold"
                    size="sm"
                    className="mt-3 w-full sm:w-auto"
                    onClick={handleResendConfirmation}
                    disabled={resendBusy || busy}
                  >
                    {resendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Renvoyer l’email de confirmation
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            {tab === "login" && (
              <>
                <Button
                  type="button"
                  variant="outlineGold"
                  className="w-full mb-4"
                  onClick={handleGoogle}
                  disabled={busy}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuer avec Google
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou par email</span></div>
                </div>
              </>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <TabsContent value="signup" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" required={tab === "signup"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">Numéro WhatsApp</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="whatsapp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+229 01 00 00 00 00" className="pl-10" required={tab === "signup"} />
                  </div>
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className="pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required minLength={6} />
                </div>
              </div>

              <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {tab === "login" ? "Se connecter" : "Créer mon compte"}
              </Button>
            </form>
          </Tabs>
        </div>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          <a href="/" className="hover:text-primary">← Retour à l'accueil</a>
        </p>
      </div>
    </div>
  );
};

export default Auth;
