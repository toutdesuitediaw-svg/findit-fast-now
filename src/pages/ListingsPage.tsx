import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListingCard, { ListingCardData } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category { id: string; name: string; slug: string; }

const ListingsPage = () => {
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const q = params.get("q") ?? "";
  const cat = params.get("cat") ?? "all";
  const sort = params.get("sort") ?? "recent";

  useEffect(() => {
    supabase.from("categories").select("id, name, slug").order("sort_order").then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchListings = async () => {
      let query = supabase
        .from("listings")
        .select("id, title, price, currency, location, images, is_premium, category:categories(slug)")
        .eq("is_active", true);

      if (q) query = query.ilike("title", `%${q}%`);

      if (sort === "price_asc") query = query.order("price", { ascending: true, nullsFirst: false });
      else if (sort === "price_desc") query = query.order("price", { ascending: false, nullsFirst: false });
      else query = query.order("is_premium", { ascending: false }).order("created_at", { ascending: false });

      const { data } = await query.limit(60);
      if (cancelled) return;
      let rows = (data ?? []) as any[];
      if (cat !== "all") rows = rows.filter((r) => r.category?.slug === cat);
      setListings(rows as ListingCardData[]);
      setLoading(false);
    };

    setLoading(true);
    fetchListings();

    const channel = supabase
      .channel("public:listings:all")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        fetchListings();
      })
      .subscribe();

    const onFocus = () => fetchListings();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [q, cat, sort]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-6">Toutes les annonces</h1>

        <div className="bg-card border border-border rounded-2xl p-4 mb-8 grid md:grid-cols-[1.5fr_1fr_1fr] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              defaultValue={q}
              placeholder="Rechercher..."
              className="pl-10"
              onKeyDown={(e) => { if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value); }}
            />
          </div>
          <Select value={cat} onValueChange={(v) => update("cat", v)}>
            <SelectTrigger><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => update("sort", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Plus récentes</SelectItem>
              <SelectItem value="price_asc">Prix croissant</SelectItem>
              <SelectItem value="price_desc">Prix décroissant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground mb-4">Aucune annonce trouvée.</p>
            <Link to="/publier" className="text-primary hover:underline font-medium">Publier une annonce →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ListingsPage;
