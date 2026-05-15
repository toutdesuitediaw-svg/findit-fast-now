import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2, LogOut, Plus, Trash2, Flag, MessageSquare, Pencil } from "lucide-react";
import MessagesTab from "@/components/MessagesTab";
import EditListingDialog from "@/components/EditListingDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  target_type: string;
  target_id: string;
  created_at: string;
}

interface Listing {
  id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  price: number | null;
  currency: string;
  location: string | null;
  images: string[];
  is_active: boolean;
  is_premium: boolean;
  premium_until: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState<Listing | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setBusy(true);
      const [{ data: l }, { data: f }, { data: p }, { data: r }] = await Promise.all([
        supabase.from("listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("favorites").select("listing:listings(*)").eq("user_id", user.id),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("reports").select("*").eq("reporter_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMyListings((l ?? []) as Listing[]);
      setFavorites(((f ?? []).map((x: any) => x.listing).filter(Boolean)) as Listing[]);
      setProfile(p);
      setReports((r ?? []) as Report[]);
      setBusy(false);
    };
    load();

    // Realtime: keep my listings + favorited listings in sync
    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          // Update my own listings list
          if (row.user_id === user.id) {
            if (payload.eventType === "INSERT") {
              setMyListings((prev) => (prev.some((x) => x.id === row.id) ? prev : [row as Listing, ...prev]));
            } else if (payload.eventType === "UPDATE") {
              setMyListings((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...(row as Listing) } : x)));
            } else if (payload.eventType === "DELETE") {
              setMyListings((prev) => prev.filter((x) => x.id !== row.id));
            }
          }
          // Sync favorited listings (premium badge, price, status...)
          setFavorites((prev) => {
            if (!prev.some((x) => x.id === row.id)) return prev;
            if (payload.eventType === "DELETE") return prev.filter((x) => x.id !== row.id);
            return prev.map((x) => (x.id === row.id ? { ...x, ...(row as Listing) } : x));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as any).listing_id;
            setFavorites((prev) => prev.filter((x) => x.id !== removedId));
          } else if (payload.eventType === "INSERT") {
            const listingId = (payload.new as any).listing_id;
            const { data } = await supabase.from("listings").select("*").eq("id", listingId).maybeSingle();
            if (data) setFavorites((prev) => (prev.some((x) => x.id === data.id) ? prev : [data as Listing, ...prev]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const deleteListing = async (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMyListings((prev) => prev.filter((l) => l.id !== id));
    toast.success("Annonce supprimée");
  };

  const removeFavorite = async (listingId: string) => {
    if (!user) return;
    await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
    setFavorites((prev) => prev.filter((l) => l.id !== listingId));
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatPrice = (l: Listing) =>
    l.price ? `${Number(l.price).toLocaleString("fr-FR")} ${l.currency}` : "À discuter";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              Bonjour, <span className="text-gradient-gold">{profile?.display_name ?? user.email}</span>
            </h1>
            <p className="text-muted-foreground mt-1">Gérez vos annonces et vos favoris</p>
          </div>
          <div className="flex gap-3">
            <Button variant="gold" onClick={() => navigate("/publier")}>
              <Plus className="w-4 h-4" /> Publier une annonce
            </Button>
            <Button variant="outlineGold" onClick={() => navigate("/profil")}>
              Mon profil
            </Button>
            <Button variant="outlineGold" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="w-4 h-4" /> Déconnexion
            </Button>
          </div>
        </div>

        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">Mes annonces ({myListings.length})</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="w-4 h-4 mr-1" /> Messages</TabsTrigger>
            <TabsTrigger value="favorites">Favoris ({favorites.length})</TabsTrigger>
            <TabsTrigger value="reports">Signalements ({reports.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-6">
            <MessagesTab userId={user.id} />
          </TabsContent>

          <TabsContent value="listings" className="mt-6">
            {busy ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : myListings.length === 0 ? (
              <EmptyState message="Aucune annonce publiée" cta="Publier ma première annonce" onCta={() => navigate("/publier")} />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {myListings.map((l) => (
                  <article key={l.id} className="rounded-2xl bg-card border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => navigate(`/annonce/${l.id}`)}
                      className="block w-full aspect-[4/3] bg-secondary overflow-hidden group"
                      aria-label={`Voir l'annonce ${l.title}`}
                    >
                      {l.images[0] ? (
                        <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Pas de photo</div>
                      )}
                    </button>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold line-clamp-1">{l.title}</h3>
                        {l.is_premium && <span className="text-[10px] font-bold bg-gradient-gold text-primary-foreground px-2 py-0.5 rounded">PREMIUM</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{l.location ?? "—"}</p>
                      <p className="font-bold text-primary">{formatPrice(l)}</p>
                      {l.is_premium && l.premium_until && (
                        <p className="text-[11px] text-primary/90 font-medium">
                          Premium jusqu'au {new Date(l.premium_until).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "long", year: "numeric",
                          })}
                        </p>
                      )}
                      <div className="flex items-center gap-1 pt-1">
                        <Button variant="outlineGold" size="sm" onClick={() => setEditing(l)}>
                          <Pencil className="w-4 h-4" /> Modifier
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteListing(l.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" /> Supprimer
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="mt-6">
            {favorites.length === 0 ? (
              <EmptyState message="Aucune annonce en favoris" cta="Parcourir les annonces" onCta={() => navigate("/")} />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {favorites.map((l) => (
                  <article key={l.id} className="rounded-2xl bg-card border border-border overflow-hidden">
                    <div className="aspect-[4/3] bg-secondary overflow-hidden cursor-pointer" onClick={() => navigate(`/annonce/${l.id}`)}>
                      {l.images[0] && <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold line-clamp-1">{l.title}</h3>
                      <p className="font-bold text-primary">{formatPrice(l)}</p>
                      <Button variant="ghost" size="sm" onClick={() => removeFavorite(l.id)}>
                        <Heart className="w-4 h-4 fill-primary text-primary" /> Retirer
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            {reports.length === 0 ? (
              <EmptyState message="Aucun signalement envoyé" cta="Parcourir les annonces" onCta={() => navigate("/")} />
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <article key={r.id} className="rounded-xl bg-card border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Flag className="w-4 h-4 text-destructive mt-1 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium line-clamp-1">{r.reason}</p>
                        {r.details && <p className="text-sm text-muted-foreground line-clamp-2">{r.details}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(r.created_at).toLocaleDateString("fr-FR")} · {r.target_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "open" ? "default" : r.status === "resolved" ? "secondary" : "outline"}>
                        {r.status === "open" ? "En cours" : r.status === "resolved" ? "Résolu" : r.status}
                      </Badge>
                      {r.target_type === "listing" && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/annonce/${r.target_id}`)}>
                          Voir
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <EditListingDialog
        open={!!editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        listing={editing}
        onSaved={(updated) => {
          setMyListings((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
          setEditing(null);
        }}
      />
      <Footer />
    </div>
  );
};

const EmptyState = ({ message, cta, onCta }: { message: string; cta: string; onCta: () => void }) => (
  <div className="text-center py-16 border border-dashed border-border rounded-2xl">
    <p className="text-muted-foreground mb-4">{message}</p>
    <Button variant="gold" onClick={onCta}>{cta}</Button>
  </div>
);

export default Dashboard;
