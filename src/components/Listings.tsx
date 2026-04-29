import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ListingCard, { ListingCardData } from "./ListingCard";

const Listings = () => {
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("listings")
      .select("id, title, price, currency, location, images, is_premium")
      .eq("is_active", true)
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setListings((data ?? []) as ListingCardData[]);
        setLoading(false);
      });
  }, []);

  return (
    <section className="container mx-auto px-4 py-8 md:py-12">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-2xl md:text-3xl font-bold">Annonces récentes</h2>
        <Link to="/annonces" className="text-sm text-primary hover:underline font-medium">
          Voir toutes les annonces →
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground mb-4">Aucune annonce pour le moment.</p>
          <Link to="/publier" className="text-primary hover:underline font-medium">Publiez la première annonce →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </section>
  );
};

export default Listings;
