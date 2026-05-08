import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ListingCard, { ListingCardData } from "./ListingCard";

const SELECT = "id, title, price, currency, location, images, is_premium";

const sortListings = (arr: ListingCardData[]) =>
  [...arr].sort((a, b) => Number(b.is_premium) - Number(a.is_premium));

const Listings = () => {
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select(SELECT)
      .eq("is_active", true)
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);
    setListings((data ?? []) as ListingCardData[]);
    setLoading(false);
    initializedRef.current = true;
  };

  useEffect(() => {
    fetchListings();

    const channel = supabase
      .channel("public:listings:home")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings" },
        async (payload) => {
          const row = payload.new as any;
          if (!row.is_active) return;
          const { data } = await supabase.from("listings").select(SELECT).eq("id", row.id).maybeSingle();
          if (!data) return;
          setListings((prev) => {
            if (prev.some((p) => p.id === data.id)) return prev;
            return sortListings([data as ListingCardData, ...prev]).slice(0, 8);
          });
          if (initializedRef.current) {
            toast.success("Nouvelle annonce publiée", { description: row.title });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings" },
        (payload) => {
          const row = payload.new as any;
          setListings((prev) => {
            const exists = prev.some((p) => p.id === row.id);
            if (!row.is_active) return exists ? prev.filter((p) => p.id !== row.id) : prev;
            if (!exists) return prev;
            return sortListings(
              prev.map((p) =>
                p.id === row.id
                  ? {
                      ...p,
                      title: row.title,
                      price: row.price,
                      currency: row.currency,
                      location: row.location,
                      images: row.images,
                      is_premium: row.is_premium,
                    }
                  : p
              )
            );
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "listings" },
        (payload) => {
          const row = payload.old as any;
          setListings((prev) => prev.filter((p) => p.id !== row.id));
        }
      )
      .subscribe();

    const onFocus = () => fetchListings();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      <div className="flex items-end justify-between mb-6 md:mb-8 gap-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-primary font-semibold uppercase mb-2">À la une</div>
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold">Annonces récentes</h2>
        </div>
        <Link to="/annonces" className="shrink-0 text-sm text-primary hover:underline font-medium">
          Voir tout →
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </section>
  );
};

export default Listings;
