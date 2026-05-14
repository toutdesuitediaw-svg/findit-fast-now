import { useNavigate } from "react-router-dom";
import { Flag, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReportListingDialog from "@/components/ReportListingDialog";
import { formatPublished, getExpiry, isNew } from "@/lib/listingDate";

export interface ListingCardData {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  location: string | null;
  images: string[];
  is_premium: boolean;
  published_at?: string | null;
  expires_at?: string | null;
}

const ListingCard = ({ listing }: { listing: ListingCardData }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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
            alt={`${listing.title}${listing.location ? ` — ${listing.location}` : ""}`}
            loading="lazy"
            decoding="async"
            width={400}
            height={300}
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
        {!listing.is_premium && isNew(listing.published_at) && (
          <span className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold tracking-widest px-2.5 py-1 rounded">
            NOUVEAU
          </span>
        )}
        {(() => {
          const exp = getExpiry(listing.expires_at);
          if (exp.status === "expired")
            return <span className="absolute bottom-3 left-3 bg-destructive text-destructive-foreground text-[10px] font-bold tracking-widest px-2.5 py-1 rounded">EXPIRÉE</span>;
          if (exp.status === "imminent")
            return <span className="absolute bottom-3 left-3 bg-amber-500 text-white text-[10px] font-bold tracking-widest px-2.5 py-1 rounded">EXPIRE BIENTÔT</span>;
          return null;
        })()}
        <button
          aria-label="Favoris"
          onClick={toggleFav}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border hover:bg-primary/20"
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
        <button
          aria-label="Signaler"
          onClick={(e) => { e.stopPropagation(); setReportOpen(true); }}
          className="absolute top-3 right-14 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="font-semibold text-foreground line-clamp-1">{listing.title}</h3>
        {listing.location && <p className="text-xs text-muted-foreground">{listing.location}</p>}
        {listing.published_at && (
          <p className="text-[11px] text-muted-foreground/80">{formatPublished(listing.published_at)}</p>
        )}
        <p className="pt-2 font-bold text-primary text-lg">{price}</p>
      </div>
      <ReportListingDialog listingId={listing.id} open={reportOpen} onOpenChange={setReportOpen} />
    </article>
  );
};

export default ListingCard;
