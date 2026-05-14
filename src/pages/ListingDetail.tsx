import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Flag, Heart, Loader2, MapPin, MessageCircle, Phone, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImageGallery from "@/components/ImageGallery";
import { toast } from "sonner";
import { useSEO, SITE_URL } from "@/lib/seo";
import { formatPublished, formatUpdated, getExpiry } from "@/lib/listingDate";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  location: string | null;
  images: string[];
  is_premium: boolean;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  quarantined_at: string | null;
  auto_removed: boolean;
  trust_score: number | null;
  user_id: string;
  category: { name: string } | null;
  seller: { display_name: string | null; phone: string | null; whatsapp: string | null; city: string | null } | null;
}

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, category:categories(name)")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Annonce introuvable");
        navigate("/");
        return;
      }
      const { data: seller } = await supabase
        .from("profiles")
        .select("display_name, phone, whatsapp, city")
        .eq("id", (data as any).user_id)
        .maybeSingle();
      if (cancelled) return;
      setListing({ ...(data as any), seller } as any);
      setLoading(false);

      if (user) {
        const { data: fav } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("listing_id", id)
          .maybeSingle();
        if (!cancelled) setIsFav(!!fav);
      }
    };
    load();

    // Realtime updates for this specific listing
    const channel = supabase
      .channel(`public:listings:detail:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as any;
          if (next.is_active === false) {
            toast.info("Cette annonce n'est plus disponible");
            navigate("/");
            return;
          }
          setListing((prev) => (prev ? { ...prev, ...next, seller: prev.seller, category: prev.category } : prev));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "listings", filter: `id=eq.${id}` },
        () => {
          toast.info("Cette annonce a été supprimée");
          navigate("/");
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id, user, navigate]);

  const toggleFav = async () => {
    if (!user) {
      toast.info("Connectez-vous pour ajouter aux favoris");
      navigate("/auth");
      return;
    }
    if (!listing) return;
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listing.id);
      setIsFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, listing_id: listing.id });
      setIsFav(true);
      toast.success("Ajouté aux favoris ❤️");
    }
  };

  const submitReport = async () => {
    if (!user) { toast.info("Connectez-vous pour signaler"); navigate("/auth"); return; }
    if (!listing || !reportReason.trim()) return;
    setSubmittingReport(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "listing",
      target_id: listing.id,
      reason: reportReason.trim(),
      details: reportDetails.trim() || null,
    });
    setSubmittingReport(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signalement envoyé. Merci !");
    setReportOpen(false);
    setReportReason("");
    setReportDetails("");
  };

  const handleOrder = () => {
    if (!listing) return;
    addItem({
      id: listing.id,
      title: listing.title,
      price: Number(listing.price ?? 0),
      currency: listing.currency,
      image: listing.images?.[0],
    });
    toast.success("Ajouté au panier");
    navigate("/panier");
  };

  useSEO({
    title: listing ? `${listing.title} — ${listing.location ?? "Sénégal"} | TOUT DE SUITE` : "Annonce | TOUT DE SUITE",
    description: listing
      ? `${listing.description?.slice(0, 155) ?? listing.title} — Petite annonce ${listing.category?.name ?? ""} ${listing.location ?? "au Sénégal"}.`
      : "Détail d'une petite annonce sur TOUT DE SUITE.",
    canonical: id ? `${SITE_URL}/annonce/${id}` : undefined,
    image: listing?.images?.[0],
    jsonLd: listing
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: listing.description,
          image: listing.images,
          category: listing.category?.name,
          offers: {
            "@type": "Offer",
            priceCurrency: listing.currency,
            price: listing.price ?? 0,
            availability: "https://schema.org/InStock",
            areaServed: listing.location ?? "Sénégal",
          },
        }
      : undefined,
  });

  if (loading || !listing) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const formatPrice = listing.price
    ? `${Number(listing.price).toLocaleString("fr-FR")} ${listing.currency}`
    : "À discuter";

  const phone = listing.seller?.whatsapp || listing.seller?.phone;
  const waNumber = phone?.replace(/[^0-9+]/g, "");
  const waMsg = encodeURIComponent(`Bonjour, je suis intéressé par votre annonce "${listing.title}" sur TOUT DE SUITE.`);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8">
          {/* Gallery */}
          <div>
            <ImageGallery
              images={listing.images || []}
              alt={listing.title}
              badge={
                listing.is_premium ? (
                  <span className="bg-gradient-gold text-primary-foreground text-xs font-bold tracking-widest px-3 py-1.5 rounded inline-flex flex-col items-center leading-tight">
                    <span>PREMIUM</span>
                    {listing.premium_until && (
                      <span className="text-[9px] font-medium tracking-normal opacity-90">
                        jusqu'au {new Date(listing.premium_until).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </span>
                ) : null
              }
              topRight={
                <button
                  onClick={toggleFav}
                  aria-label="Ajouter aux favoris"
                  className="w-11 h-11 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border hover:bg-primary/20"
                >
                  <Heart className={`w-5 h-5 ${isFav ? "fill-primary text-primary" : "text-foreground"}`} />
                </button>
              }
            />

            <div className="mt-8">
              <h2 className="font-display text-xl font-bold mb-3">Description</h2>
              <p className="text-foreground/85 whitespace-pre-line leading-relaxed">{listing.description}</p>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              {listing.category && (
                <span className="inline-block text-xs bg-primary/15 text-primary px-2.5 py-1 rounded font-medium">
                  {listing.category.name}
                </span>
              )}
              <h1 className="font-display text-2xl md:text-3xl font-bold">{listing.title}</h1>
              <p className="text-3xl font-bold text-gradient-gold">{formatPrice}</p>
              {listing.location && (
                <p className="flex items-center gap-2 text-muted-foreground text-sm">
                  <MapPin className="w-4 h-4 text-primary" /> {listing.location}
                </p>
              )}
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border/50">
                <p>{formatPublished(listing.published_at || listing.created_at)}</p>
                {listing.updated_at && listing.updated_at !== listing.created_at && (
                  <p>{formatUpdated(listing.updated_at)}</p>
                )}
                {(() => {
                  const exp = getExpiry(listing.expires_at);
                  if (!exp.label) return null;
                  const cls = exp.status === "expired" ? "text-destructive" : exp.status === "imminent" ? "text-amber-500" : exp.status === "soon" ? "text-amber-400/80" : "text-muted-foreground";
                  return <p className={cls}>{exp.label}</p>;
                })()}
              </div>
              {(listing.quarantined_at || listing.auto_removed) && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    {listing.auto_removed ? "Annonce supprimée par modération IA" : "Annonce en quarantaine"}
                  </div>
                  {typeof listing.trust_score === "number" && (
                    <p>Score de confiance : {listing.trust_score}/100</p>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`/moderation/case/${listing.id}`)}>
                    Voir le motif et contester
                  </Button>
                </div>
              )}
              {user?.id === listing.user_id && (() => {
                const exp = getExpiry(listing.expires_at);
                if (exp.status === "fresh") return null;
                return (
                  <Button
                    variant="gold"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      const { data, error } = await supabase.functions.invoke("renew-listing", { body: { listing_id: listing.id } });
                      if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || "Erreur"); return; }
                      toast.success("Annonce renouvelée pour 1 an");
                    }}
                  >
                    <RefreshCw className="w-4 h-4" /> Renouveler l'annonce
                  </Button>
                );
              })()}
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Vendeur</p>
                <p className="font-semibold text-lg">{listing.seller?.display_name ?? "Utilisateur"}</p>
                {listing.seller?.city && <p className="text-xs text-muted-foreground">{listing.seller.city}</p>}
              </div>

              <Button variant="gold" className="w-full" onClick={handleOrder}>
                <ShoppingCart className="w-4 h-4" /> Commander
              </Button>

              {waNumber ? (
                <>
                  <Button variant="gold" className="w-full" asChild>
                    <a href={`https://wa.me/${waNumber}?text=${waMsg}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-4 h-4" /> Contacter sur WhatsApp
                    </a>
                  </Button>
                  <Button variant="outlineGold" className="w-full" asChild>
                    <a href={`tel:${waNumber}`}>
                      <Phone className="w-4 h-4" /> Appeler
                    </a>
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Le vendeur n'a pas renseigné de numéro de contact.
                </p>
              )}
              <button
                onClick={() => setReportOpen(true)}
                className="w-full text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 pt-2 border-t border-border/50 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" /> Signaler cette annonce
              </button>
            </div>
          </aside>
        </div>
      </main>
      <Footer />

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Signaler cette annonce</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motif</Label>
              <Input value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Ex: Arnaque, contenu interdit, faux produit..." />
            </div>
            <div>
              <Label>Détails (facultatif)</Label>
              <Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Décrivez le problème" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={submitReport} disabled={submittingReport || !reportReason.trim()}>
              {submittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer le signalement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListingDetail;
