import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, MessageCircle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  whatsapp: string | null;
  items: CartItem[];
  subtotal: number;
}

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clear, total, count, currency } = useCart();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [groups, setGroups] = useState<SellerGroup[] | null>(null);
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [contactedSellers, setContactedSellers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (groups) {
      setSelectedSellers(new Set(groups.filter((g) => g.whatsapp).map((g) => g.sellerId)));
      setContactedSellers(new Set());
    }
  }, [groups]);

  const toggleSeller = (id: string) => {
    setSelectedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fmt = (n: number) => `${Number(n).toLocaleString("fr-FR")} ${currency}`;

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

    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, user_id, seller:profiles!listings_user_id_fkey(display_name, whatsapp, phone)")
      .in("id", items.map((i) => i.id));

    if (error) {
      setLoadingCheckout(false);
      toast.error("Impossible de contacter le vendeur");
      return;
    }

    const map = new Map<string, SellerGroup>();
    for (const item of items) {
      const listing = listings?.find((l) => l.id === item.id) as any;
      const sellerId = listing?.user_id ?? "unknown";
      const sellerName = listing?.seller?.display_name ?? "Vendeur";
      const whatsapp = listing?.seller?.whatsapp ?? listing?.seller?.phone ?? null;
      const existing = map.get(sellerId);
      if (existing) {
        existing.items.push(item);
        existing.subtotal += item.price * item.quantity;
      } else {
        map.set(sellerId, {
          sellerId,
          sellerName,
          whatsapp,
          items: [item],
          subtotal: item.price * item.quantity,
        });
      }
    }

    const list = Array.from(map.values());
    setLoadingCheckout(false);

    const reachable = list.filter((g) => g.whatsapp);
    if (reachable.length === 0) {
      toast.error("Aucun vendeur n'a renseigné de numéro WhatsApp.");
      return;
    }

    const orderNumber = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      Math.random() * 1000
    ).toString().padStart(3, "0")}`;

    if (list.length === 1 && reachable.length === 1) {
      window.open(waLink(reachable[0], orderNumber), "_blank", "noopener,noreferrer");
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

    setGroups(list);
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
    const order = {
      orderNumber,
      items: orderItems,
      total: orderTotal,
      currency,
      date: new Date().toISOString(),
    };
    setGroups(null);
    selectedItemIds.forEach((id) => removeItem(id));
    navigate("/commande/confirmation", { state: order });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart className="w-7 h-7 text-primary" />
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Mon <span className="text-gradient-gold">panier</span>
          </h1>
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
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="Diminuer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="w-7 text-center font-medium">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
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

      <Dialog open={!!groups} onOpenChange={(o) => !o && setGroups(null)}>
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
                const allReachable = groups?.filter((g) => g.whatsapp).map((g) => g.sellerId) ?? [];
                setSelectedSellers(
                  selectedSellers.size === allReachable.length ? new Set() : new Set(allReachable)
                );
              }}
            >
              {selectedSellers.size === groups?.filter((g) => g.whatsapp).length
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {groups?.map((g) => {
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
            const selected = groups?.filter((g) => selectedSellers.has(g.sellerId)) ?? [];
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
            <Button variant="ghost" onClick={() => setGroups(null)}>
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
