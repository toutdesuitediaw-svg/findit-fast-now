import { useNavigate } from "react-router-dom";
import { Flag, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReportListingDialog from "@/components/ReportListingDialog";

export interface ListingCardData {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  location: string | null;
  images: string[];
  is_premium: boolean;
}

const ListingCard = ({ listing }: { listing: ListingCardData }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listing.id)
      .maybeSingle()
      .then(({ data }) => setIsFav(!!data));
  }, [user, listing.id]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.info("Connectez-vous pour ajouter aux favoris");
      navigate("/auth");
      return;
    }
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listing.id);
      setIsFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, listing_id: listing.id });
      setIsFav(true);
    }
  };

  const price = listing.price
    ? `${Number(listing.price).toLocaleString("fr-FR")} ${listing.currency}`
    : "À discuter";

  return (
    <article
      onClick={() => navigate(`/annonce/${listing.id}`)}
      className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold cursor-pointer"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        {listing.images[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Pas de photo</div>
        )}
        {listing.is_premium && (
          <span className="absolute top-3 left-3 bg-gradient-gold text-primary-foreground text-[10px] font-bold tracking-widest px-2.5 py-1 rounded">
            PREMIUM
          </span>
        )}
        <button
          aria-label="Favoris"
          onClick={toggleFav}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border hover:bg-primary/20"
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="font-semibold text-foreground line-clamp-1">{listing.title}</h3>
        {listing.location && <p className="text-xs text-muted-foreground">{listing.location}</p>}
        <p className="pt-2 font-bold text-primary text-lg">{price}</p>
      </div>
    </article>
  );
};

export default ListingCard;
