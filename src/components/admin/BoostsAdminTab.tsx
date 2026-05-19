import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, Crown, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Tx = {
  id: string;
  user_id: string;
  listing_id: string | null;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type Listing = { id: string; title: string };

interface Props {
  transactions: Tx[];
  listings: Listing[];
  emails: Record<string, string | null>;
  onUpdate: (id: string, status: "completed" | "failed") => Promise<void>;
}

export default function BoostsAdminTab({ transactions, listings, emails, onUpdate }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const boosts = useMemo(
    () => transactions.filter((t) => t.type === "listing_boost"),
    [transactions],
  );
  const pending = boosts.filter((t) => t.status === "pending");
  const approved = boosts.filter((t) => t.status === "completed");
  const rejected = boosts.filter((t) => t.status === "failed");

  const listingTitle = (id: string | null) =>
    (id && listings.find((l) => l.id === id)?.title) || "—";

  const handle = async (id: string, status: "completed" | "failed") => {
    setBusy(id);
    try { await onUpdate(id, status); } finally { setBusy(null); }
  };

  const renderRows = (rows: Tx[], showActions: boolean) =>
    rows.length === 0 ? (
      <TableRow>
        <TableCell colSpan={showActions ? 7 : 6} className="text-center py-8 text-muted-foreground">
          Aucun élément
        </TableCell>
      </TableRow>
    ) : (
      rows.map((t) => {
        const meta = (t.metadata ?? {}) as Record<string, string | number>;
        const boostType = String(meta.boost_type ?? "premium");
        const duration = Number(meta.duration_days ?? 0);
        return (
          <TableRow key={t.id}>
            <TableCell className="text-xs whitespace-nowrap">
              {new Date(t.created_at).toLocaleString("fr-FR")}
            </TableCell>
            <TableCell className="text-xs">{emails[t.user_id] ?? t.user_id.slice(0, 8)}</TableCell>
            <TableCell className="max-w-[220px] truncate">{listingTitle(t.listing_id)}</TableCell>
            <TableCell>
              <Badge variant="outline" className="gap-1">
                {boostType === "urgent" ? <Flame className="w-3 h-3 text-red-500" /> : <Crown className="w-3 h-3 text-primary" />}
                {boostType} {duration ? `· ${duration}j` : ""}
              </Badge>
            </TableCell>
            <TableCell className="font-medium whitespace-nowrap">
              {Number(t.amount).toLocaleString("fr-FR")} {t.currency}
            </TableCell>
            <TableCell>
              <Badge variant={t.status === "completed" ? "default" : t.status === "failed" ? "destructive" : "secondary"}>
                {t.status === "completed" ? "Approuvé" : t.status === "failed" ? "Refusé" : "En attente"}
              </Badge>
            </TableCell>
            {showActions && (
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="gold" disabled={busy === t.id} onClick={() => handle(t.id, "completed")}>
                    <CheckCircle2 className="w-4 h-4" /> Approuver
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => handle(t.id, "failed")}
                    className="text-destructive hover:text-destructive">
                    <XCircle className="w-4 h-4" /> Refuser
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        );
      })
    );

  const table = (rows: Tx[], showActions: boolean) => (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Annonce</TableHead>
              <TableHead>Formule</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows(rows, showActions)}</TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total boosts</div><div className="text-2xl font-bold">{boosts.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">En attente</div><div className="text-2xl font-bold text-amber-500">{pending.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Approuvés</div><div className="text-2xl font-bold text-primary">{approved.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Refusés</div><div className="text-2xl font-bold text-destructive">{rejected.length}</div></Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending"><Clock className="w-4 h-4 mr-1" /> En attente ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved"><CheckCircle2 className="w-4 h-4 mr-1" /> Approuvés ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected"><XCircle className="w-4 h-4 mr-1" /> Refusés ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">{table(pending, true)}</TabsContent>
        <TabsContent value="approved" className="mt-4">{table(approved, false)}</TabsContent>
        <TabsContent value="rejected" className="mt-4">{table(rejected, false)}</TabsContent>
      </Tabs>
    </div>
  );
}
