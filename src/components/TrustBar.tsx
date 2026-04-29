import { Headphones, ShieldCheck, Users, Zap } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "100% Sécurisé", desc: "Vos données sont protégées" },
  { icon: Headphones, title: "Support disponible", desc: "7j/7 pour vous aider" },
  { icon: Zap, title: "Publication rapide", desc: "En quelques clics seulement" },
  { icon: Users, title: "Communauté active", desc: "Des milliers d'utilisateurs" },
];

const TrustBar = () => {
  return (
    <section className="border-y border-border/50 bg-card/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
