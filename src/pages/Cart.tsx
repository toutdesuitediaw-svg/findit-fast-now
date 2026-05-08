import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clear, total, count, currency } = useCart();

  const fmt = (n: number) => `${Number(n).toLocaleString("fr-FR")} ${currency}`;

  const checkout = () => {
    if (items.length === 0) return;
    toast.success("Commande validée ! Nous vous contactons sous peu.");
    clear();
    navigate("/");
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
              <Button variant="gold" className="w-full" onClick={checkout}>
                Valider la commande
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Le paiement et la livraison sont organisés directement avec le vendeur.
              </p>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
