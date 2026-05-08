import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, LogIn, MessageCircle, Minus, Plus, ShoppingCart, Trash2, UserCheck, UserX } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  whatsapp: string | null;
  items: CartItem[];
  subtotal: number;
}

interface SellerMeta {
  sellerName: string;
  whatsapp: string | null;
}

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clear, total, count, currency } = useCart();
  const { user, loading: authLoading } = useAuth();
  const fmt = (n: number) => `${Number(n).toLocaleString("fr-FR")} ${currency}`;

  const handleQtyChange = (id: string, qty: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const safeQty = Math.min(99, Math.max(0, qty));
    if (safeQty === item.quantity) return;
    updateQuantity(id, safeQty);
    if (safeQty === 0) {
      toast.success(`"${item.title}" retiré du panier`);
      return;
    }
    const newTotal = items.reduce(
      (s, i) => s + i.price * (i.id === id ? safeQty : i.quantity),
      0,
    );
    toast.success(`Quantité : ${safeQty}`, {
      description: `Nouveau total : ${fmt(newTotal)}`,
      duration: 1800,
    });
  };
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  // listingId -> sellerId
  const [itemSellerMap, setItemSellerMap] = useState<Record<string, string> | null>(null);
  // sellerId -> meta
  const [sellerMeta, setSellerMeta] = useState<Record<string, SellerMeta>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [contactedSellers, setContactedSellers] = useState<Set<string>>(new Set());

  // Derive groups from live cart items + seller map (recomputes on quantity change)
  const groups: SellerGroup[] = useMemo(() => {
    if (!itemSellerMap) return [];
    const map = new Map<string, SellerGroup>();
    for (const item of items) {
      const sellerId = itemSellerMap[item.id] ?? "unknown";
      const meta = sellerMeta[sellerId] ?? { sellerName: "Vendeur", whatsapp: null };
      const existing = map.get(sellerId);
      if (existing) {
        existing.items.push(item);
        existing.subtotal += item.price * item.quantity;
      } else {
        map.set(sellerId, {
          sellerId,
          sellerName: meta.sellerName,
          whatsapp: meta.whatsapp,
          items: [item],
          subtotal: item.price * item.quantity,
        });
      }
    }
    return Array.from(map.values());
  }, [items, itemSellerMap, sellerMeta]);

  // When dialog opens, default-select all reachable sellers
  useEffect(() => {
    if (dialogOpen) {
      setSelectedSellers(new Set(groups.filter((g) => g.whatsapp).map((g) => g.sellerId)));
      setContactedSellers(new Set());
    }
  }, [dialogOpen]);

  // Auto-deselect sellers that disappeared (e.g. all their items removed)
  useEffect(() => {
    if (!dialogOpen) return;
    const validIds = new Set(groups.map((g) => g.sellerId));
    setSelectedSellers((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    if (groups.length === 0) setDialogOpen(false);
  }, [groups, dialogOpen]);

  const toggleSeller = (id: string) => {
    setSelectedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  const buildMessage = (group: SellerGroup, orderNumber: string) => {
    const lines = [
      `Bonjour ${group.sellerName},`,
      ``,
      `Je souhaite commander sur TOUT DE SUITE (n° ${orderNumber}) :`,
      ``,
      ...group.items.map(
        (i) => `• ${i.title} × ${i.quantity} — ${fmt(i.price * i.quantity)}`
      ),
      ``,
      `Total : ${fmt(group.subtotal)}`,
      ``,
      `Pouvez-vous confirmer la disponibilité et le mode de livraison ? Merci !`,
    ];
    return lines.join("\n");
  };

  const waLink = (group: SellerGroup, orderNumber: string) => {
    const number = (group.whatsapp ?? "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(buildMessage(group, orderNumber))}`;
  };

  const checkout = async () => {
    if (items.length === 0) return;
    setLoadingCheckout(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoadingCheckout(false);
      toast.info("Connectez-vous pour valider votre commande");
      navigate(`/auth?redirect=${encodeURIComponent("/panier")}`);
      return;
    }

    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, user_id")
      .in("id", items.map((i) => i.id));

    if (error) {
      setLoadingCheckout(false);
      toast.error("Impossible de contacter le vendeur");
      return;
    }

    const sellerIdSet = Array.from(new Set((listings ?? []).map((l: any) => l.user_id)));
    const { data: sellers } = await supabase
      .from("profiles")
      .select("id, display_name, whatsapp, phone")
      .in("id", sellerIdSet);
    const sellerById: Record<string, any> = {};
    for (const s of (sellers ?? []) as any[]) sellerById[s.id] = s;

    const map: Record<string, string> = {};
    const meta: Record<string, SellerMeta> = {};
    for (const l of (listings ?? []) as any[]) {
      map[l.id] = l.user_id;
      const s = sellerById[l.user_id];
      meta[l.user_id] = {
        sellerName: s?.display_name ?? "Vendeur",
        whatsapp: s?.whatsapp ?? s?.phone ?? null,
      };
    }
    setItemSellerMap(map);
    setSellerMeta(meta);
    setLoadingCheckout(false);

    const sellerIds = new Set(Object.values(map));
    const reachableIds = [...sellerIds].filter((id) => meta[id]?.whatsapp);
    if (reachableIds.length === 0) {
      toast.error("Aucun vendeur n'a renseigné de numéro WhatsApp.");
      return;
    }

    if (sellerIds.size === 1 && reachableIds.length === 1) {
      const sellerId = reachableIds[0];
      const orderNumber = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        Math.random() * 1000
      ).toString().padStart(3, "0")}`;
      const group: SellerGroup = {
        sellerId,
        sellerName: meta[sellerId].sellerName,
        whatsapp: meta[sellerId].whatsapp,
        items: [...items],
        subtotal: total,
      };
      window.open(waLink(group, orderNumber), "_blank", "noopener,noreferrer");
      const order = {
        orderNumber,
        items: [...items],
        total,
        currency,
        date: new Date().toISOString(),
      };
      clear();
      navigate("/commande/confirmation", { state: order });
      return;
    }

    setDialogOpen(true);
  };

  const contactSeller = (group: SellerGroup) => {
    const orderNumber = `CMD-${Date.now().toString(36).toUpperCase()}`;
    window.open(waLink(group, orderNumber), "_blank", "noopener,noreferrer");
    setContactedSellers((prev) => new Set(prev).add(group.sellerId));
  };

  const finishMultiSeller = () => {
    if (!groups) return;
    const selected = groups.filter((g) => selectedSellers.has(g.sellerId));
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins un vendeur");
      return;
    }
    const selectedItemIds = new Set(selected.flatMap((g) => g.items.map((i) => i.id)));
    const orderItems = items.filter((i) => selectedItemIds.has(i.id));
    const orderTotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const orderNumber = `CMD-${Date.now().toString(36).toUpperCase()}`;

    // Ouvre un onglet WhatsApp pré-rempli pour chaque vendeur sélectionné
    selected.forEach((g, idx) => {
      const url = waLink(g, `${orderNumber}-${idx + 1}`);
      window.open(url, "_blank", "noopener,noreferrer");
    });

    const order = {
      orderNumber,
      items: orderItems,
      total: orderTotal,
      currency,
      date: new Date().toISOString(),
    };
    setDialogOpen(false);
    selectedItemIds.forEach((id) => removeItem(id));
    navigate("/commande/confirmation", { state: order });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingCart className="w-7 h-7 text-primary" />
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Mon <span className="text-gradient-gold">panier</span>
          </h1>
        </div>

        <div
          className={`mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            user
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm">
            {authLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Vérification de la session…</span>
              </>
            ) : user ? (
              <>
                <UserCheck className="w-4 h-4 text-primary" />
                <span>
                  Connecté en tant que{" "}
                  <span className="font-semibold">{user.email}</span>
                </span>
              </>
            ) : (
              <>
                <UserX className="w-4 h-4 text-destructive" />
                <span className="text-destructive font-medium">
                  Non connecté — connectez-vous pour valider la commande
                </span>
              </>
            )}
          </div>
          {!authLoading && !user && (
            <Button
              variant="gold"
              size="sm"
              onClick={() => navigate(`/auth?redirect=${encodeURIComponent("/panier")}`)}
            >
              <LogIn className="w-4 h-4" /> Se connecter
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-6">Votre panier est vide</p>
            <Button variant="gold" onClick={() => navigate("/annonces")}>
              Parcourir les annonces
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
            <section className="space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-center"
                >
                  <div
                    className="w-20 h-20 rounded-lg bg-secondary overflow-hidden shrink-0 cursor-pointer"
                    onClick={() => navigate(`/annonce/${item.id}`)}
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold line-clamp-1 cursor-pointer hover:text-primary"
                      onClick={() => navigate(`/annonce/${item.id}`)}
                    >
                      {item.title}
                    </h3>
                    <p className="text-primary font-bold mt-1">{fmt(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleQtyChange(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="Diminuer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isNaN(v)) return;
                        handleQtyChange(item.id, Math.min(99, Math.max(1, v)));
                      }}
                      onBlur={(e) => {
                        if (!e.target.value) handleQtyChange(item.id, 1);
                      }}
                      aria-label="Quantité"
                      className="w-12 h-8 text-center text-sm font-medium bg-transparent outline-none focus:ring-2 focus:ring-primary/40 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleQtyChange(item.id, Math.min(99, item.quantity + 1))}
                      disabled={item.quantity >= 99}
                      aria-label="Augmenter"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    aria-label="Retirer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </article>
              ))}

              <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
                Vider le panier
              </Button>
            </section>

            <aside className="lg:sticky lg:top-24 h-fit bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-xl font-bold">Résumé</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Articles</span>
                  <span>{count}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Sous-total</span>
                  <span>{fmt(total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Livraison</span>
                  <span>À convenir</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold text-gradient-gold">{fmt(total)}</span>
              </div>
              <Button variant="gold" className="w-full" onClick={checkout} disabled={loadingCheckout}>
                {loadingCheckout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" /> Valider via WhatsApp
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Un message pré-rempli sera envoyé au vendeur pour finaliser la commande.
              </p>
            </aside>
          </div>
        )}
      </main>
      <Footer />

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sélectionnez les vendeurs à contacter</DialogTitle>
            <DialogDescription>
              Cochez uniquement les vendeurs avec qui vous voulez commander. Les articles
              non sélectionnés resteront dans votre panier.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{selectedSellers.size} vendeur(s) sélectionné(s)</span>
            <button
              type="button"
              className="hover:text-primary underline"
              onClick={() => {
                const allReachable = groups.filter((g) => g.whatsapp).map((g) => g.sellerId) ?? [];
                setSelectedSellers(
                  selectedSellers.size === allReachable.length ? new Set() : new Set(allReachable)
                );
              }}
            >
              {selectedSellers.size === groups.filter((g) => g.whatsapp).length
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {groups.map((g) => {
              const checked = selectedSellers.has(g.sellerId);
              const contacted = contactedSellers.has(g.sellerId);
              return (
                <label
                  key={g.sellerId}
                  className={`border rounded-xl p-3 flex items-center gap-3 transition-colors ${
                    !g.whatsapp
                      ? "border-border opacity-60 cursor-not-allowed"
                      : checked
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : "border-border hover:border-primary/50 cursor-pointer"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!g.whatsapp}
                    onCheckedChange={() => g.whatsapp && toggleSeller(g.sellerId)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold line-clamp-1 flex items-center gap-2">
                      {g.sellerName}
                      {contacted && <Check className="w-3.5 h-3.5 text-primary" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.items.length} article{g.items.length > 1 ? "s" : ""} · {fmt(g.subtotal)}
                    </p>
                  </div>
                  {g.whatsapp ? (
                    <Button
                      variant={contacted ? "outlineGold" : "gold"}
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        contactSeller(g);
                      }}
                      disabled={!checked}
                    >
                      <MessageCircle className="w-4 h-4" />
                      {contacted ? "Renvoyer" : "Contacter"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pas de WhatsApp</span>
                  )}
                </label>
              );
            })}
          </div>

          {(() => {
            const selected = groups.filter((g) => selectedSellers.has(g.sellerId)) ?? [];
            const itemCount = selected.reduce(
              (s, g) => s + g.items.reduce((n, i) => n + i.quantity, 0),
              0
            );
            const subtotal = selected.reduce((s, g) => s + g.subtotal, 0);
            return (
              <div className="border-t border-border pt-3 mt-1 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Vendeurs sélectionnés</span>
                  <span>{selected.length}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Articles</span>
                  <span>{itemCount}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-gradient-gold">{fmt(subtotal)}</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="outlineGold"
              onClick={finishMultiSeller}
              disabled={selectedSellers.size === 0}
            >
              Confirmer la commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cart;
