import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Package } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { CartItem } from "@/hooks/useCart";

interface OrderState {
  orderNumber: string;
  items: CartItem[];
  total: number;
  currency: string;
  date: string;
}

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state as OrderState | null;

  useEffect(() => {
    if (!order) navigate("/", { replace: true });
  }, [order, navigate]);

  if (!order) return null;

  const fmt = (n: number) => `${Number(n).toLocaleString("fr-FR")} ${order.currency}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 mb-4">
            <CheckCircle2 className="w-9 h-9 text-primary" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Commande <span className="text-gradient-gold">confirmée</span>
          </h1>
          <p className="text-muted-foreground">
            Merci ! Le vendeur vous contactera très prochainement.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">N° de commande</p>
              <p className="font-mono font-bold text-lg">{order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Date</p>
              <p className="text-sm font-medium">
                {new Date(order.date).toLocaleString("fr-FR")}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Récapitulatif
            </h2>
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-lg bg-secondary overflow-hidden shrink-0">
                  {item.image && (
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Quantité : {item.quantity}
                  </p>
                </div>
                <p className="font-semibold text-primary">
                  {fmt(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-between items-baseline">
            <span className="font-semibold">Total payé</span>
            <span className="text-2xl font-bold text-gradient-gold">{fmt(order.total)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Button variant="gold" asChild>
            <Link to="/annonces">Continuer mes achats</Link>
          </Button>
          <Button variant="outlineGold" asChild>
            <Link to="/dashboard">Voir mon compte</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderConfirmation;
