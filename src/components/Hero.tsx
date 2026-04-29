import { MapPin, Rocket, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import heroBg from "@/assets/hero-bg.jpg";
import Logo from "./Logo";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      {/* Glow background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl animate-glow-pulse" />

      <div className="container relative mx-auto px-4 py-16 md:py-24 lg:py-28">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          {/* Left content */}
          <div className="space-y-8">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.05] tracking-tight">
              ACHETEZ, VENDEZ,
              <br />
              TROUVEZ TOUT,
              <br />
              <span className="text-gradient-gold">TOUT DE SUITE !</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              La plateforme numéro 1 pour tous vos annonces simples, rapides et efficaces.
            </p>

            <div className="flex flex-wrap gap-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Annonces vérifiées</div>
                  <div className="text-xs text-muted-foreground">Sécurité et confiance</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Résultats rapides</div>
                  <div className="text-xs text-muted-foreground">Vendez ou trouvez vite</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - infinity emblem */}
          <div className="hidden lg:flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-radial-gold blur-2xl" style={{ background: 'var(--gradient-radial-gold)' }} />
            <div className="relative animate-float text-center">
              <svg viewBox="0 0 200 100" className="w-72 h-36 drop-shadow-[0_0_40px_hsl(45_95%_65%/0.6)]">
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(45 95% 65%)" />
                    <stop offset="50%" stopColor="hsl(43 74% 56%)" />
                    <stop offset="100%" stopColor="hsl(38 60% 45%)" />
                  </linearGradient>
                </defs>
                <path
                  d="M50,50 C50,25 75,25 100,50 C125,75 150,75 150,50 C150,25 125,25 100,50 C75,75 50,75 50,50 Z"
                  fill="none"
                  stroke="url(#goldGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
              </svg>
              <div className="mt-4">
                <Logo />
              </div>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-12 lg:mt-16">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-card">
            <div className="grid md:grid-cols-[1.6fr_1fr_1fr_auto] gap-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Que recherchez-vous ?"
                  className="pl-11 h-14 bg-transparent border-0 focus-visible:ring-0 text-base placeholder:text-muted-foreground"
                />
              </div>
              <button className="flex items-center gap-2 px-4 h-14 rounded-lg bg-secondary/60 hover:bg-secondary text-left text-sm transition-colors">
                <span className="flex-1 text-muted-foreground">Toutes catégories</span>
                <span className="text-primary">▾</span>
              </button>
              <button className="flex items-center gap-2 px-4 h-14 rounded-lg bg-secondary/60 hover:bg-secondary text-left text-sm transition-colors">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="flex-1 text-muted-foreground">Toutes les localités</span>
              </button>
              <Button variant="gold" className="h-14 px-8 text-base">
                <Search className="w-5 h-5" />
                Rechercher
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
