import { Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const PromoBanner = () => {
  return (
    <section id="premium" className="container mx-auto px-4 py-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-secondary to-card border border-primary/30 p-8 md:p-12">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative grid md:grid-cols-[auto_1fr_auto] items-center gap-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold-lg shrink-0">
            <Star className="w-10 h-10 text-primary-foreground fill-primary-foreground" />
          </div>

          <div>
            <h3 className="font-display text-2xl md:text-3xl font-bold mb-2">
              Boostez vos annonces
            </h3>
            <p className="text-muted-foreground max-w-xl">
              Mettez en avant vos annonces avec l'option Premium et touchez jusqu'à 10x plus de personnes intéressées.
            </p>
          </div>

          <Button variant="gold" size="lg" className="shrink-0">
            <TrendingUp className="w-4 h-4" />
            En savoir plus
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
