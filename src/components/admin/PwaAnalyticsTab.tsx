import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Download, Loader2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PwaEvent = {
  id: string;
  event_type: string;
  platform: string | null;
  user_agent: string | null;
  referrer: string | null;
  user_id: string | null;
  created_at: string;
};

type RangeKey = "7" | "30" | "90" | "custom";

type Thresholds = { ctr_min: number; accept_min: number };

const DEFAULT_THRESHOLDS: Thresholds = { ctr_min: 10, accept_min: 50 };

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function PwaAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PwaEvent[]>([]);
  const [range, setRange] = useState<RangeKey>("30");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [savingTh, setSavingTh] = useState(false);

  // Resolve effective date range
  const { fromDate, toDate } = useMemo(() => {
    if (range === "custom" && from && to) {
      return { fromDate: new Date(from), toDate: new Date(to + "T23:59:59") };
    }
    const days = range === "custom" ? 30 : parseInt(range, 10);
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - days);
    return { fromDate: f, toDate: t };
  }, [range, from, to]);

  // Load thresholds from site_settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "pwa_alert_thresholds")
        .maybeSingle();
      if (data?.value && typeof data.value === "object") {
        const v = data.value as Partial<Thresholds>;
        setThresholds({
          ctr_min: typeof v.ctr_min === "number" ? v.ctr_min : DEFAULT_THRESHOLDS.ctr_min,
          accept_min: typeof v.accept_min === "number" ? v.accept_min : DEFAULT_THRESHOLDS.accept_min,
        });
      }
    })();
  }, []);

  // Load events for range
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pwa_install_events")
        .select("*")
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      if (!cancelled) {
        if (error) toast.error("Erreur de chargement analytics");
        setEvents((data as PwaEvent[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  // Aggregations
  const metrics = useMemo(() => {
    const counts = { page_view: 0, install_click: 0, install_accepted: 0, install_dismissed: 0, app_installed: 0 };
    const byPlatform: Record<string, { views: number; clicks: number; accepted: number; installed: number }> = {};
    const bySource: Record<string, { views: number; clicks: number; installed: number }> = {};

    for (const e of events) {
      if (e.event_type in counts) (counts as any)[e.event_type] += 1;
      const p = e.platform || "unknown";
      byPlatform[p] = byPlatform[p] || { views: 0, clicks: 0, accepted: 0, installed: 0 };
      if (e.event_type === "page_view") byPlatform[p].views += 1;
      if (e.event_type === "install_click") byPlatform[p].clicks += 1;
      if (e.event_type === "install_accepted") byPlatform[p].accepted += 1;
      if (e.event_type === "app_installed") byPlatform[p].installed += 1;

      const src = e.referrer || "direct";
      bySource[src] = bySource[src] || { views: 0, clicks: 0, installed: 0 };
      if (e.event_type === "page_view") bySource[src].views += 1;
      if (e.event_type === "install_click") bySource[src].clicks += 1;
      if (e.event_type === "app_installed") bySource[src].installed += 1;
    }

    const ctr = counts.page_view > 0 ? (counts.install_click / counts.page_view) * 100 : 0;
    const acceptRate = counts.install_click > 0 ? (counts.install_accepted / counts.install_click) * 100 : 0;
    const conversion = counts.page_view > 0 ? (counts.app_installed / counts.page_view) * 100 : 0;

    return { counts, byPlatform, bySource, ctr, acceptRate, conversion };
  }, [events]);

  const alerts = useMemo(() => {
    const out: string[] = [];
    if (metrics.counts.page_view >= 20 && metrics.ctr < thresholds.ctr_min) {
      out.push(`Taux de clic Installer (${fmtPct(metrics.ctr)}) sous le seuil de ${thresholds.ctr_min}%`);
    }
    if (metrics.counts.install_click >= 10 && metrics.acceptRate < thresholds.accept_min) {
      out.push(`Taux d'acceptation (${fmtPct(metrics.acceptRate)}) sous le seuil de ${thresholds.accept_min}%`);
    }
    return out;
  }, [metrics, thresholds]);

  const saveThresholds = async () => {
    setSavingTh(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({
        key: "pwa_alert_thresholds",
        value: thresholds as any,
        description: "Seuils d'alerte pour le dashboard PWA (en %)",
      }, { onConflict: "key" });
    setSavingTh(false);
    if (error) toast.error("Échec de la sauvegarde");
    else toast.success("Seuils enregistrés");
  };

  const exportCsv = () => {
    const header = ["created_at", "event_type", "platform", "referrer", "user_id", "user_agent"];
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = events.map(e => header.map(h => escape((e as any)[h])).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pwa-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const platformRows = Object.entries(metrics.byPlatform).sort((a, b) => b[1].views - a[1].views);
  const sourceRows = Object.entries(metrics.bySource)
    .sort((a, b) => b[1].installed - a[1].installed || b[1].views - a[1].views)
    .slice(0, 25);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="font-semibold">Période :</span>
          </div>
          {(["7", "30", "90"] as RangeKey[]).map(r => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
            >
              {r}j
            </Button>
          ))}
          <Button
            size="sm"
            variant={range === "custom" ? "default" : "outline"}
            onClick={() => setRange("custom")}
          >
            Personnalisé
          </Button>
          {range === "custom" && (
            <>
              <div>
                <Label className="text-xs">Du</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Au</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
              </div>
            </>
          )}
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={events.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              Exporter CSV ({events.length})
            </Button>
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-destructive">Alertes performance</div>
              {alerts.map((a, i) => (
                <div key={i} className="text-sm">{a}</div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Vues /installer</div>
              <div className="text-2xl font-bold">{metrics.counts.page_view}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Clics Installer</div>
              <div className="text-2xl font-bold">{metrics.counts.install_click}</div>
              <div className="text-xs text-muted-foreground mt-1">CTR : {fmtPct(metrics.ctr)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Acceptations</div>
              <div className="text-2xl font-bold text-primary">{metrics.counts.install_accepted}</div>
              <div className="text-xs text-muted-foreground mt-1">Taux : {fmtPct(metrics.acceptRate)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Apps installées</div>
              <div className="text-2xl font-bold text-primary">{metrics.counts.app_installed}</div>
              <div className="text-xs text-muted-foreground mt-1">Conversion : {fmtPct(metrics.conversion)}</div>
            </Card>
          </div>

          {/* Platform breakdown */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Répartition iOS / Android / Desktop</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plateforme</TableHead>
                  <TableHead className="text-right">Vues</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Acceptés</TableHead>
                  <TableHead className="text-right">Installés</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune donnée</TableCell></TableRow>
                ) : platformRows.map(([p, m]) => {
                  const conv = m.views > 0 ? (m.installed / m.views) * 100 : 0;
                  return (
                    <TableRow key={p}>
                      <TableCell><Badge variant="outline">{p}</Badge></TableCell>
                      <TableCell className="text-right">{m.views}</TableCell>
                      <TableCell className="text-right">{m.clicks}</TableCell>
                      <TableCell className="text-right">{m.accepted}</TableCell>
                      <TableCell className="text-right font-semibold">{m.installed}</TableCell>
                      <TableCell className="text-right">{fmtPct(conv)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Source breakdown */}
          <Card className="p-4">
            <h3 className="font-semibold mb-1">Sources de trafic (referrer / UTM)</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Préfixe <code>utm:</code> = lien marketing tagué · <code>ref:</code> = site référent · <code>direct</code> = accès direct
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Vues</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Installés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucune donnée</TableCell></TableRow>
                ) : sourceRows.map(([src, m]) => (
                  <TableRow key={src}>
                    <TableCell className="font-mono text-xs max-w-xs truncate">{src}</TableCell>
                    <TableCell className="text-right">{m.views}</TableCell>
                    <TableCell className="text-right">{m.clicks}</TableCell>
                    <TableCell className="text-right font-semibold">{m.installed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Threshold settings */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Seuils d'alerte</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">CTR minimum (%)</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={thresholds.ctr_min}
                  onChange={e => setThresholds(t => ({ ...t, ctr_min: parseFloat(e.target.value) || 0 }))}
                  className="w-32"
                />
              </div>
              <div>
                <Label className="text-xs">Acceptation minimum (%)</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={thresholds.accept_min}
                  onChange={e => setThresholds(t => ({ ...t, accept_min: parseFloat(e.target.value) || 0 }))}
                  className="w-32"
                />
              </div>
              <Button onClick={saveThresholds} disabled={savingTh} size="sm">
                {savingTh && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Enregistrer
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Une alerte s'affiche au-dessus du dashboard quand les seuils ne sont pas atteints (avec un volume minimum de 20 vues / 10 clics).
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
