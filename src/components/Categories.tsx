import { Briefcase, Car, Home, MoreHorizontal, ShoppingBag, Smartphone } from "lucide-react";

const categories = [
  { icon: Home, label: "Immobilier", desc: "Maisons, Appartements, Terrains..." },
  { icon: Car, label: "Véhicules", desc: "Voitures, Motos, Camions..." },
  { icon: Smartphone, label: "Électronique", desc: "Téléphones, Ordinateurs, Accessoires..." },
  { icon: Briefcase, label: "Emploi", desc: "Offres d'emploi, Recrutement..." },
  { icon: ShoppingBag, label: "Mode & Beauté", desc: "Vêtements, Chaussures, Parfums..." },
  { icon: MoreHorizontal, label: "Divers", desc: "Maison, Services, Autres..." },
];

const Categories = () => {
  return (
    <section id="categories" className="container mx-auto px-4 py-12 md:py-16">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map(({ icon: Icon, label, desc }) => (
          <a
            href="#"
            key={label}
            className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-card/40 border border-border/50 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:-translate-y-1"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</p>
          </a>
        ))}
      </div>
    </section>
  );
};

export default Categories;
