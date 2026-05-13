import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles, Shield, AlertTriangle, Activity, RefreshCcw, Trash2, CheckCircle2,
  Eye, Bot, Gavel, MessageSquare, Loader2, ShieldOff,
} from "lucide-react";
import { toast } from "sonner";

type CaseStatus = "pending" | "quarantined" | "removed" | "cleared" | "appealed";
type Risk = "low" | "medium" | "high" | "critical";

interface ModCase {
  id: string;
  listing_id: string;
  user_id: string;
  status: CaseStatus;
  trust_score: number | null;
  risk_level: Risk | null;
  ai_verdict: any;
  reports_count: number;
  auto_action: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Appeal {
  id: string;
  case_id: string;
  user_id: string;
  message: string;
  status: "open" | "accepted" | "rejected";
  admin_note: string | null;
  created_at: string;
}

interface ListingLite {
  id: string;
  title: string;
  user_id: string;
  is_active: boolean;
  images: string[] | null;
}

const riskColor: Record<Risk, string> = {
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusLabel: Record<CaseStatus, string> = {
  pending: "En analyse",
  quarantined: "Quarantaine",
  removed: "Supprimée",
  cleared: "Validée",
  appealed: "Contestée",
};

export default function ModerationAITab() {
  const [cases, setCases] = useState<ModCase[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [listings, setListings] = useState<Record<string, ListingLite>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | CaseStatus>("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [appealDialog, setAppealDialog] = useState<Appeal | null>(null);
  const [appealNote, setAppealNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [c, a] = await Promise.all([
      supabase.from("moderation_cases").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("moderation_appeals").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const cs = (c.data ?? []) as ModCase[];
    const as_ = (a.data ?? []) as Appeal[];
    setCases(cs);
    setAppeals(as_);

    const ids = Array.from(new Set(cs.map((x) => x.listing_id)));
    if (ids.length) {
      const { data: ls } = await supabase
        .from("listings")
        .select("id, title, user_id, is_active, images")
        .in("id", ids);
      const map: Record<string, ListingLite> = {};
      (ls ?? []).forEach((l: any) => (map[l.id] = l));
      setListings(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("mod-cases")
      .on("postgres_changes", { event: "*", schema: "public", table: "moderation_cases" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "moderation_appeals" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const since24h = Date.now() - 86400000;
    return {
      open: cases.filter((c) => c.status === "pending" || c.status === "quarantined").length,
      autoRemoved24h: cases.filter(
        (c) => c.status === "removed" && c.auto_action && new Date(c.created_at).getTime() > since24h,
      ).length,
      critical: cases.filter((c) => c.risk_level === "critical").length,
      cleared: cases.filter((c) => c.status === "cleared").length,
      appealsOpen: appeals.filter((a) => a.status === "open").length,
    };
  }, [cases, appeals]);

  const filtered = useMemo(
    () => (filter === "all" ? cases : cases.filter((c) => c.status === filter)),
    [cases, filter],
  );

  const reAnalyze = async (c: ModCase) => {
    setActingId(c.id);
    const { error } = await supabase.functions.invoke("moderate-listing", {
      body: { case_id: c.id, listing_id: c.listing_id },
    });
    setActingId(null);
    if (error) toast.error(error.message);
    else toast.success("Analyse IA relancée");
    load();
  };

  const restore = async (c: ModCase) => {
    setActingId(c.id);
    const { error: e1 } = await supabase
      .from("listings")
      .update({ is_active: true, auto_removed: false, quarantined_at: null })
      .eq("id", c.listing_id);
    const { error: e2 } = await supabase
      .from("moderation_cases")
      .update({ status: "cleared", resolved_at: new Date().toISOString() })
      .eq("id", c.id);
    setActingId(null);
    if (e1 || e2) toast.error((e1 || e2)!.message);
    else toast.success("Annonce restaurée");
    load();
  };

  const confirmRemoval = async (c: ModCase) => {
    if (!confirm("Confirmer la suppression définitive de cette annonce ?")) return;
    setActingId(c.id);
    const { error } = await supabase.from("listings").delete().eq("id", c.listing_id);
    setActingId(null);
    if (error) toast.error(error.message);
    else toast.success("Annonce supprimée");
    load();
  };

  const banVendor = async (c: ModCase) => {
    if (!confirm("Bannir le vendeur associé à cette annonce ?")) return;
    setActingId(c.id);
    const { error } = await supabase.from("profiles").update({ status: "banned" }).eq("id", c.user_id);
    setActingId(null);
    if (error) toast.error(error.message);
    else toast.success("Vendeur banni");
    load();
  };

  const resolveAppeal = async (status: "accepted" | "rejected") => {
    if (!appealDialog) return;
    const { error } = await supabase
      .from("moderation_appeals")
      .update({
        status,
        admin_note: appealNote || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", appealDialog.id);
    if (error) return toast.error(error.message);
    if (status === "accepted") {
      const c = cases.find((x) => x.id === appealDialog.case_id);
      if (c) {
        await supabase
          .from("listings")
          .update({ is_active: true, auto_removed: false, quarantined_at: null })
          .eq("id", c.listing_id);
        await supabase
          .from("moderation_cases")
          .update({ status: "cleared", resolved_at: new Date().toISOString() })
          .eq("id", c.id);
      }
    }
    toast.success("Contestation traitée");
    setAppealDialog(null);
    setAppealNote("");
    load();
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 border-primary/30 bg-gradient-to-br from-background to-primary/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="w-3 h-3" /> Cases ouverts</div>
          <div className="text-2xl font-bold text-primary mt-1">{stats.open}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Auto-supprimées 24h</div>
          <div className="text-2xl font-bold text-destructive mt-1">{stats.autoRemoved24h}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="w-3 h-3" /> Critiques</div>
          <div className="text-2xl font-bold text-orange-500 mt-1">{stats.critical}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3" /> Validées par IA</div>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.cleared}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gavel className="w-3 h-3" /> Contestations</div>
          <div className="text-2xl font-bold text-amber-500 mt-1">{stats.appealsOpen}</div>
        </Card>
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases"><Shield className="w-4 h-4 mr-1" />Dossiers IA</TabsTrigger>
          <TabsTrigger value="appeals"><Gavel className="w-4 h-4 mr-1" />Contestations ({stats.appealsOpen})</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "quarantined", "removed", "cleared", "appealed"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "gold" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "Tous" : statusLabel[f as CaseStatus]}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Aucun dossier dans cette catégorie.</Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((c) => {
                const l = listings[c.listing_id];
                const verdict = c.ai_verdict || {};
                const score = c.trust_score ?? 0;
                const cats = (verdict.categories as string[]) || [];
                const reasons = (verdict.reasons as string[]) || [];
                const cover = l?.images?.[0];
                return (
                  <Card key={c.id} className="p-4 border-border/60 hover:border-primary/40 transition-colors">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex gap-3 md:w-2/5">
                        {cover ? (
                          <img src={cover} alt={l?.title} className="w-20 h-20 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">N/A</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{l?.title ?? "(annonce supprimée)"}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">{c.listing_id}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="outline">{statusLabel[c.status]}</Badge>
                            {c.risk_level && <Badge className={`${riskColor[c.risk_level]} border`}>{c.risk_level}</Badge>}
                            <Badge variant="secondary">{c.reports_count} signalement(s)</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="md:w-1/5">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-primary" /> Score de confiance
                        </div>
                        <div className="text-3xl font-bold text-primary">{score}<span className="text-sm text-muted-foreground">/100</span></div>
                        <Progress value={score} className="h-2 mt-1" />
                      </div>

                      <div className="md:w-2/5 space-y-2">
                        {cats.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cats.map((cat) => (
                              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                            ))}
                          </div>
                        )}
                        {reasons.length > 0 && (
                          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                            {reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        )}
                        {verdict.error && (
                          <div className="text-xs text-destructive">Erreur IA : {String(verdict.error).slice(0, 120)}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button size="sm" variant="outline" onClick={() => reAnalyze(c)} disabled={actingId === c.id}>
                        {actingId === c.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                        Ré-analyser
                      </Button>
                      {l && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/listing/${l.id}`} target="_blank" rel="noreferrer"><Eye className="w-3 h-3 mr-1" /> Voir</a>
                        </Button>
                      )}
                      {(c.status === "quarantined" || c.status === "removed") && (
                        <Button size="sm" variant="outline" onClick={() => restore(c)} disabled={actingId === c.id}>
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Restaurer
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => confirmRemoval(c)} disabled={actingId === c.id}>
                        <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => banVendor(c)} disabled={actingId === c.id}>
                        <ShieldOff className="w-3 h-3 mr-1 text-destructive" /> Bannir vendeur
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appeals" className="space-y-3">
          {appeals.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Aucune contestation.</Card>
          ) : (
            appeals.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={a.status === "open" ? "destructive" : a.status === "accepted" ? "default" : "secondary"}
                      >
                        {a.status === "open" ? "Ouverte" : a.status === "accepted" ? "Acceptée" : "Rejetée"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-sm mt-2 flex gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{a.message}</span>
                    </p>
                    {a.admin_note && (
                      <p className="text-xs text-muted-foreground mt-2 italic">Note admin : {a.admin_note}</p>
                    )}
                  </div>
                  {a.status === "open" && (
                    <Button size="sm" variant="gold" onClick={() => { setAppealDialog(a); setAppealNote(""); }}>
                      Traiter
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!appealDialog} onOpenChange={(o) => !o && setAppealDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Traiter la contestation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Message du vendeur :</p>
            <p className="text-sm p-3 rounded-md border border-border bg-muted/30">{appealDialog?.message}</p>
            <Textarea
              placeholder="Note interne (facultatif)"
              value={appealNote}
              onChange={(e) => setAppealNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAppealDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => resolveAppeal("rejected")}>Rejeter</Button>
            <Button variant="gold" onClick={() => resolveAppeal("accepted")}>Accepter et restaurer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
