import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ListingCard, { type ListingCardData } from "@/components/ListingCard";

interface Props {
  mode: "similar" | "foryou";
  listingId?: string;
  userId?: string;
  title?: string;
}

const AIRecommendations = ({ mode, listingId, userId, title }: Props) => {
  const [items, setItems] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("recommend-listings", {
          body: { mode, listing_id: listingId, user_id: userId },
        });
        if (!cancelled && data?.items) setItems(data.items as ListingCardData[]);
      } catch (e) {
        console.warn("recommend failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, listingId, userId]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">
            {title ?? (mode === "similar" ? "Annonces similaires" : "Recommandé pour vous")}
          </h2>
          <span className="text-xs text-muted-foreground ml-2">IA</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Analyse en cours…
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </section>
  );
};

export default AIRecommendations;
