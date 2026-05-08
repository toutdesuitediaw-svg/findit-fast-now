import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListingCard, { ListingCardData } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO, SITE_URL, DEFAULT_IMAGE } from "@/lib/seo";

interface Category { id: string; name: string; slug: string; }

const ListingsPage = () => {
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const q = params.get("q") ?? "";
  const cat = params.get("cat") ?? "all";
  const sort = params.get("sort") ?? "recent";
  const city = params.get("city") ?? "";
  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";

  const minNum = minPrice ? Number(minPrice) : null;
  const maxNum = maxPrice ? Number(maxPrice) : null;

  const catName = useMemo(() => categories.find((c) => c.slug === cat)?.name, [categories, cat]);
  const seoTitle = useMemo(() => {
    const parts = ["Annonces"];
    if (catName) parts.push(catName.toLowerCase());
    if (city) parts.push(city);
    else parts.push("Sénégal");
    return `${parts.join(" ")} | TOUT DE SUITE`;
  }, [catName, city]);

  useSEO({
    title: seoTitle,
    description: `Parcourez les petites annonces ${catName ?? ""} ${city || "au Sénégal"} : immobilier, voitures, emploi, électronique. Achetez et vendez près de chez vous.`,
    canonical: `${SITE_URL}/annonces`,
    image: DEFAULT_IMAGE,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seoTitle,
      url: `${SITE_URL}/annonces`,
    },
  });

  useEffect(() => {
    supabase.from("categories").select("id, name, slug").order("sort_order").then(({ data }) => setCategories(data ?? []));
  }, []);

  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    initializedRef.current = false;

    const SELECT = "id, title, price, currency, location, images, is_premium, category:categories(slug)";

    const applySort = (rows: any[]) => {
      if (sort === "price_asc") return [...rows].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      if (sort === "price_desc") return [...rows].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      return [...rows].sort((a, b) => Number(b.is_premium) - Number(a.is_premium));
    };

    const matches = (row: any) => {
      if (!row.is_active) return false;
      if (q && !String(row.title ?? "").toLowerCase().includes(q.toLowerCase())) return false;
      if (cat !== "all" && row.category?.slug !== cat) return false;
      if (city && !String(row.location ?? "").toLowerCase().includes(city.toLowerCase())) return false;
      if (minNum != null && (row.price ?? 0) < minNum) return false;
      if (maxNum != null && (row.price ?? Infinity) > maxNum) return false;
      return true;
    };

    const fetchListings = async () => {
      let query = supabase.from("listings").select(SELECT).eq("is_active", true);
      if (q) query = query.ilike("title", `%${q}%`);
      if (city) query = query.ilike("location", `%${city}%`);
      if (minNum != null) query = query.gte("price", minNum);
      if (maxNum != null) query = query.lte("price", maxNum);
      if (sort === "price_asc") query = query.order("price", { ascending: true, nullsFirst: false });
      else if (sort === "price_desc") query = query.order("price", { ascending: false, nullsFirst: false });
      else query = query.order("is_premium", { ascending: false }).order("created_at", { ascending: false });

      const { data } = await query.limit(60);
      if (cancelled) return;
      let rows = (data ?? []) as any[];
      if (cat !== "all") rows = rows.filter((r) => r.category?.slug === cat);
      setListings(rows as ListingCardData[]);
      setLoading(false);
      initializedRef.current = true;
    };

    setLoading(true);
    fetchListings();

    const fetchOne = async (id: string) => {
      const { data } = await supabase.from("listings").select(SELECT).eq("id", id).maybeSingle();
      return data as any;
    };

    const channel = supabase
      .channel("public:listings:all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings" },
        async (payload) => {
          const full = await fetchOne((payload.new as any).id);
          if (!full || !matches(full)) return;
          setListings((prev) => {
            if (prev.some((p) => p.id === full.id)) return prev;
            return applySort([full, ...prev]).slice(0, 60) as ListingCardData[];
          });
          if (initializedRef.current) {
            toast.success("Nouvelle annonce", { description: full.title });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings" },
        async (payload) => {
          const id = (payload.new as any).id;
          const full = await fetchOne(id);
          setListings((prev) => {
            const exists = prev.some((p) => p.id === id);
            if (!full || !matches(full)) return exists ? prev.filter((p) => p.id !== id) : prev;
            const next = exists ? prev.map((p) => (p.id === id ? full : p)) : [full, ...prev];
            return applySort(next).slice(0, 60) as ListingCardData[];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "listings" },
        (payload) => {
          const id = (payload.old as any).id;
          setListings((prev) => prev.filter((p) => p.id !== id));
        }
      )
      .subscribe();

    const onFocus = () => fetchListings();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [q, cat, sort, city, minPrice, maxPrice]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const resetFilters = () => setParams(new URLSearchParams());
  const hasAdvanced = !!(city || minPrice || maxPrice);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
          {catName ? `Annonces ${catName.toLowerCase()}` : "Toutes les annonces"}
          {city && ` à ${city}`}
        </h1>
        <p className="text-muted-foreground mb-6">
          Trouvez des annonces {city ? `à ${city}` : "partout au Sénégal"} : immobilier, voitures, emploi, services.
        </p>

        <div className="bg-card border border-border rounded-2xl p-4 mb-4 grid md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3">
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
          <Button
            type="button"
            variant={showFilters || hasAdvanced ? "default" : "outline"}
            onClick={() => setShowFilters((s) => !s)}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtres{hasAdvanced ? " ●" : ""}
          </Button>
        </div>

        {(showFilters || hasAdvanced) && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-8 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ville</label>
              <Input
                defaultValue={city}
                placeholder="Dakar, Thiès, Saint-Louis..."
                onKeyDown={(e) => { if (e.key === "Enter") update("city", (e.target as HTMLInputElement).value.trim()); }}
                onBlur={(e) => update("city", e.target.value.trim())}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prix min (FCFA)</label>
              <Input
                type="number"
                inputMode="numeric"
                defaultValue={minPrice}
                placeholder="0"
                onBlur={(e) => update("min", e.target.value.trim())}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prix max (FCFA)</label>
              <Input
                type="number"
                inputMode="numeric"
                defaultValue={maxPrice}
                placeholder="∞"
                onBlur={(e) => update("max", e.target.value.trim())}
              />
            </div>
            <Button variant="ghost" onClick={resetFilters}>Réinitialiser</Button>
          </div>
        )}

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
