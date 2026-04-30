import { Link } from "react-router-dom";
import { Briefcase, Car, Home, MoreHorizontal, ShoppingBag, Smartphone } from "lucide-react";

const categories = [
  { icon: Home, label: "Immobilier", desc: "Maisons, Appartements, Terrains...", slug: "immobilier" },
  { icon: Car, label: "Véhicules", desc: "Voitures, Motos, Camions...", slug: "vehicules" },
  { icon: Smartphone, label: "Électronique", desc: "Téléphones, Ordinateurs, Accessoires...", slug: "electronique" },
  { icon: Briefcase, label: "Emploi", desc: "Offres d'emploi, Recrutement...", slug: "emploi" },
  { icon: ShoppingBag, label: "Mode & Beauté", desc: "Vêtements, Chaussures, Parfums...", slug: "mode-beaute" },
  { icon: MoreHorizontal, label: "Divers", desc: "Maison, Services, Autres...", slug: "divers" },
];

const Categories = () => {
  return (
    <section id="categories" className="container mx-auto px-4 py-10 md:py-16">
      <div className="flex items-end justify-between mb-6 md:mb-8">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-primary font-semibold uppercase mb-2">Explorer</div>
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold">Catégories populaires</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {categories.map(({ icon: Icon, label, desc, slug }) => (
          <Link
            to={`/annonces?cat=${slug}`}
            key={label}
            className="group relative flex flex-col items-center text-center p-4 md:p-5 rounded-2xl bg-card/60 border border-border/60 hover:border-primary/60 hover:bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">{label}</h3>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 leading-snug">{desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default Categories;
