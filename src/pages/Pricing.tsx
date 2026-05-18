import { Check, Crown, Flame, Briefcase, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useSEO, SITE_URL } from "@/lib/seo";
import { BOOST_PLANS } from "@/components/BoostDialog";

const PROS = [
  {
    name: "Starter Pro",
    price: 10000,
    period: "/ mois",
    icon: Briefcase,
    features: ["Jusqu'à 20 annonces actives", "Badge Pro sur toutes vos annonces", "Statistiques de base", "Support prioritaire"],
  },
  {
    name: "Business Pro",
    price: 25000,
    period: "/ mois",
    featured: true,
    icon: Crown,
    features: ["Annonces illimitées", "5 boosts Premium offerts / mois", "Badge Pro + Vérifié", "Dashboard avancé & exports", "Support dédié WhatsApp"],
  },
  {
    name: "Enterprise",
    price: null,
    period: "Sur devis",
    icon: BadgeCheck,
    features: ["API & intégrations", "Multi-utilisateurs", "Account manager", "SLA garanti"],
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  useSEO({
    title: "Tarifs Premium, Boost & Comptes Pro — TOUT DE SUITE",
    description:
      "Boostez vos annonces au Sénégal : formules Premium, Urgent et abonnements Pro. Visibilité maximale, vendez plus vite sur TOUT DE SUITE.",
    canonical: `${SITE_URL}/tarifs`,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 space-y-16">
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Boostez vos ventes,{" "}
            <span className="text-gradient-gold">vendez plus vite</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Publier reste 100% gratuit. Donnez plus de visibilité à vos annonces avec nos options premium.
          </p>
        </section>

        {/* Boost packs */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-2">Boost à l'unité</h2>
          <p className="text-muted-foreground mb-6">Paiement unique par annonce, activation après confirmation.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BOOST_PLANS.map((p) => {
              const isPremium = p.type === "premium";
              const Icon = p.icon;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border-2 p-5 ${isPremium ? "border-primary/40 bg-primary/5" : "border-red-500/40 bg-red-500/5"}`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${isPremium ? "text-primary" : "text-red-500"}`} />
                  <h3 className="font-bold">{p.label}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{p.highlight}</p>
                  <p className="text-2xl font-bold">
                    {p.price.toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">FCFA</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Boostez vos annonces directement depuis votre tableau de bord.
          </p>
        </section>

        {/* Pro plans */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-2">Abonnements Pro</h2>
          <p className="text-muted-foreground mb-6">Pour les professionnels, commerces et agences.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {PROS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    plan.featured ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-gold" : "border-border bg-card"
                  }`}
                >
                  {plan.featured && (
                    <span className="self-start text-[10px] font-bold tracking-widest bg-gradient-gold text-primary-foreground px-2 py-1 rounded mb-3">
                      LE PLUS POPULAIRE
                    </span>
                  )}
                  <Icon className="w-7 h-7 text-primary mb-3" />
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <div className="mt-3 mb-5">
                    {plan.price ? (
                      <p className="text-3xl font-bold">
                        {plan.price.toLocaleString("fr-FR")}{" "}
                        <span className="text-sm font-normal text-muted-foreground">FCFA {plan.period}</span>
                      </p>
                    ) : (
                      <p className="text-2xl font-bold text-muted-foreground">{plan.period}</p>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.featured ? "default" : "outlineGold"}
                    onClick={() => navigate("/publier")}
                  >
                    {plan.price ? "Choisir cette offre" : "Nous contacter"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Badges legend */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-display text-2xl font-bold mb-4">Les badges TOUT DE SUITE</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 bg-gradient-gold text-primary-foreground text-xs font-bold px-2 py-1 rounded uppercase tracking-widest">
                <Crown className="w-3 h-3" /> Premium
              </span>
              <p className="text-muted-foreground">Annonce mise en avant en tête de liste.</p>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-widest">
                <Flame className="w-3 h-3" /> Urgent
              </span>
              <p className="text-muted-foreground">Vente prioritaire, attention immédiate.</p>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-widest">
                <Briefcase className="w-3 h-3" /> Pro
              </span>
              <p className="text-muted-foreground">Compte professionnel actif.</p>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-widest">
                <BadgeCheck className="w-3 h-3" /> Vérifié
              </span>
              <p className="text-muted-foreground">Identité confirmée par notre équipe.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
