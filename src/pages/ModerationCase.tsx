import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Sparkles, ArrowLeft, MessageSquare } from "lucide-react";

interface ModCase {
  id: string;
  listing_id: string;
  user_id: string;
  status: string;
  trust_score: number | null;
  risk_level: string | null;
  ai_verdict: any;
  reports_count: number;
  created_at: string;
}

export default function ModerationCase() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState<ModCase | null>(null);
  const [appeal, setAppeal] = useState<any | null>(null);
  const [listingTitle, setListingTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!caseId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("moderation_cases").select("*").eq("id", caseId).maybeSingle();
      if (error || !data) { toast.error("Dossier introuvable"); navigate("/dashboard"); return; }
      setC(data as ModCase);
      const { data: l } = await supabase.from("listings").select("title").eq("id", data.listing_id).maybeSingle();
      setListingTitle(l?.title || "");
      const { data: ap } = await supabase
        .from("moderation_appeals")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAppeal(ap);
      setLoading(false);
    })();
  }, [caseId, user, authLoading, navigate]);

  const submitAppeal = async () => {
    if (!c || !user) return;
    if (message.trim().length < 20) { toast.error("Veuillez détailler votre contestation (20 caractères min)."); return; }
    setSubmitting(true);
    const { error } = await supabase.from("moderation_appeals").insert({
      case_id: c.id,
      user_id: user.id,
      message: message.trim(),
    });
    if (!error) {
      await supabase.from("moderation_cases").update({ status: "appealed" }).eq("id", c.id);
    }
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Contestation envoyée. Notre équipe va l'examiner.");
    setMessage("");
    const { data: ap } = await supabase
      .from("moderation_appeals")
      .select("*")
      .eq("case_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAppeal(ap);
  };

  if (loading || !c) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const verdict = c.ai_verdict || {};
  const reasons = (verdict.reasons as string[]) || [];
  const cats = (verdict.categories as string[]) || [];
  const score = c.trust_score ?? 0;
  const canAppeal = !appeal && (c.status === "removed" || c.status === "quarantined");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Mon tableau de bord</Link>
        </Button>

        <Card className="p-6 border-primary/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Décision de modération</h1>
              <p className="text-sm text-muted-foreground truncate">{listingTitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline">{c.status}</Badge>
            {c.risk_level && <Badge variant="secondary">Risque : {c.risk_level}</Badge>}
            <Badge>{c.reports_count} signalement(s)</Badge>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm mb-1">
              <Sparkles className="w-4 h-4 text-primary" /> Score de confiance IA
            </div>
            <div className="text-3xl font-bold text-primary">{score}<span className="text-base text-muted-foreground">/100</span></div>
            <Progress value={score} className="h-2 mt-1" />
          </div>

          {cats.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Catégories détectées</div>
              <div className="flex flex-wrap gap-1">{cats.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}</div>
            </div>
          )}

          {reasons.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-1">Raisons</div>
              <ul className="text-sm list-disc list-inside space-y-1">
                {reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {appeal && (
            <Card className="p-3 bg-muted/30 border-border/50 mb-4">
              <div className="flex items-center gap-2 text-xs mb-1">
                <MessageSquare className="w-3 h-3" /> Votre contestation
                <Badge variant="outline" className="ml-auto">{appeal.status}</Badge>
              </div>
              <p className="text-sm">{appeal.message}</p>
              {appeal.admin_note && <p className="text-xs text-muted-foreground mt-2 italic">Note admin : {appeal.admin_note}</p>}
            </Card>
          )}

          {canAppeal && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Contester cette décision</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Expliquez pourquoi vous estimez la décision injustifiée…"
                maxLength={1000}
                rows={5}
              />
              <Button variant="gold" onClick={submitAppeal} disabled={submitting || message.trim().length < 20}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Envoyer la contestation
              </Button>
            </div>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
