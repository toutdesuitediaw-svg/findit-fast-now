import { Heart } from "lucide-react";
import apartment from "@/assets/listing-apartment.jpg";
import car from "@/assets/listing-car.jpg";
import phone from "@/assets/listing-phone.jpg";
import job from "@/assets/listing-job.jpg";

const listings = [
  { img: apartment, title: "Appartement à louer", location: "Almadies", meta: "Meublé · 2 chambres", price: "250 000 FCFA / mois", premium: true },
  { img: car, title: "Toyota Land Cruiser 2020", location: "Dakar", meta: "Automatique · Diesel · 45 000 km", price: "22 000 000 FCFA" },
  { img: phone, title: "iPhone 14 Pro Max 256 Go", location: "Plateau", meta: "Très bon état", price: "430 000 FCFA" },
  { img: job, title: "Comptable expérimenté", location: "Dakar", meta: "CDI · Temps plein", price: "À discuter" },
];

const Listings = () => {
  return (
    <section className="container mx-auto px-4 py-8 md:py-12">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-2xl md:text-3xl font-bold">Annonces récentes</h2>
        <a href="#" className="text-sm text-primary hover:underline font-medium">
          Voir toutes les annonces →
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {listings.map((l, i) => (
          <article
            key={i}
            className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={l.img}
                alt={l.title}
                loading="lazy"
                width={800}
                height={600}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {l.premium && (
                <span className="absolute top-3 left-3 bg-gradient-gold text-primary-foreground text-[10px] font-bold tracking-widest px-2.5 py-1 rounded">
                  PREMIUM
                </span>
              )}
              <button
                aria-label="Favoris"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border hover:bg-primary hover:border-primary transition-colors group/heart"
              >
                <Heart className="w-4 h-4 text-foreground group-hover/heart:fill-primary-foreground group-hover/heart:text-primary-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              <h3 className="font-semibold text-foreground line-clamp-1">{l.title}</h3>
              <p className="text-xs text-muted-foreground">{l.location}</p>
              <p className="text-xs text-muted-foreground">{l.meta}</p>
              <p className="pt-2 font-bold text-primary text-lg">{l.price}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Listings;
