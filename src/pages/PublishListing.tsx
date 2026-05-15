import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AlertCircle, Check, ImagePlus, Loader2, Pencil, RotateCw, Sparkles, Star, Trash2, TriangleAlert, X, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { MAX_GALLERY_IMAGES } from "@/components/ImageGallery";

const PREMIUM_PRICE_FCFA = 2000;
const PREMIUM_DURATION_DAYS = 30;

const schema = z.object({
  title: z.string().trim().min(3, "Au moins 3 caractères").max(120),
  description: z.string().trim().min(10, "Au moins 10 caractères").max(2000),
  price: z.string().optional(),
  location: z.string().trim().max(100).optional(),
  category_id: z.string().uuid("Choisissez une catégorie"),
});

interface Category { id: string; name: string; }

type UploadStatus = "pending" | "uploading" | "done" | "error";
interface PhotoItem {
  id: string;
  file: File;
  preview: string;
  status: UploadStatus;
  url?: string;
  error?: string;
}

const PublishListing = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  // Tracks photos cancelled mid-upload so we ignore their late responses
  const cancelledRef = useRef<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    location: "",
    category_id: "",
    is_premium: false,
  });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLang, setAiLang] = useState<"fr" | "en">("fr");
  const [aiProgress, setAiProgress] = useState(0);
  const [aiPhase, setAiPhase] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRejected, setAiRejected] = useState<{ url: string; reason: string }[]>([]);
  const [aiPreview, setAiPreview] = useState<{ title?: string; description: string } | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiIntervalRef = useRef<number | null>(null);
  const draftLoadedRef = useRef(false);
  const [confirmPremiumOpen, setConfirmPremiumOpen] = useState(false);

  const stopAiTimers = () => {
    if (aiIntervalRef.current !== null) {
      window.clearInterval(aiIntervalRef.current);
      aiIntervalRef.current = null;
    }
  };

  const cancelAiGeneration = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    stopAiTimers();
    setAiBusy(false);
    setAiProgress(0);
    setAiPhase("");
    toast.info(aiLang === "en" ? "AI generation cancelled" : "Génération IA annulée");
  };

  const generateWithAI = async () => {
    const urls = photos.filter((p) => p.status === "done" && p.url).map((p) => p.url!);
    if (urls.length === 0) {
      toast.error("Ajoutez au moins une photo (uploadée) pour utiliser l'IA.");
      return;
    }
    const categoryName = categories.find((c) => c.id === form.category_id)?.name;
    const isEn = aiLang === "en";
    const phases = isEn
      ? [
          { at: 0, label: "Preparing photos…" },
          { at: 15, label: "Analyzing images…" },
          { at: 45, label: "Detecting product details…" },
          { at: 70, label: "Writing description…" },
          { at: 90, label: "Finalizing…" },
        ]
      : [
          { at: 0, label: "Préparation des photos…" },
          { at: 15, label: "Analyse des images…" },
          { at: 45, label: "Détection des détails produit…" },
          { at: 70, label: "Rédaction de la description…" },
          { at: 90, label: "Finalisation…" },
        ];

    setAiError(null);
    setAiRejected([]);
    setAiBusy(true);
    setAiProgress(2);
    setAiPhase(phases[0].label);

    aiIntervalRef.current = window.setInterval(() => {
      setAiProgress((p) => {
        if (p >= 92) return p;
        const inc = p < 30 ? 3 : p < 60 ? 2 : p < 85 ? 1 : 0.5;
        const next = Math.min(92, p + inc);
        const phase = [...phases].reverse().find((ph) => next >= ph.at);
        if (phase) setAiPhase(phase.label);
        return next;
      });
    }, 250);

    const controller = new AbortController();
    aiAbortRef.current = controller;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = (import.meta.env as any).VITE_SUPABASE_URL as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-listing-description`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({
          imageUrls: urls.slice(0, 6),
          categoryName,
          title: form.title || undefined,
          language: aiLang,
        }),
        signal: controller.signal,
      });
      const data = await resp.json().catch(() => ({}));
      if (Array.isArray(data?.rejected)) setAiRejected(data.rejected);
      if (!resp.ok || data?.error) {
        const msg =
          data?.error ||
          (resp.status === 429
            ? isEn ? "Too many requests. Try again." : "Trop de requêtes. Réessayez."
            : resp.status === 402
              ? isEn ? "AI credits exhausted." : "Crédits IA épuisés."
              : isEn ? `Generation failed (${resp.status}).` : `Échec de la génération (${resp.status}).`);
        throw new Error(msg);
      }
      const { title, description } = data as { title?: string; description?: string };
      if (!description) throw new Error(isEn ? "Empty AI response." : "Réponse IA vide.");
      setAiProgress(100);
      setAiPhase(isEn ? "Done ✨" : "Terminé ✨");
      setAiPreview({ title, description });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || (isEn ? "AI generation failed" : "Échec de la génération IA");
      setAiError(msg);
      toast.error(msg);
    } finally {
      stopAiTimers();
      window.setTimeout(() => {
        setAiBusy(false);
        setAiProgress(0);
        setAiPhase("");
        aiAbortRef.current = null;
      }, 400);
    }
  };

  const acceptAiPreview = () => {
    if (!aiPreview) return;
    setForm((f) => ({
      ...f,
      title: !f.title && aiPreview.title ? aiPreview.title : f.title,
      description: aiPreview.description,
    }));
    setAiPreview(null);
    toast.success(aiLang === "en" ? "Description applied" : "Description appliquée");
  };


  const doneCount = photos.filter((p) => p.status === "done").length;
  const errorCount = photos.filter((p) => p.status === "error").length;
  const uploadingCount = photos.filter((p) => p.status === "uploading").length;

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
    if (user) {
      supabase.from("profiles").select("status").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data?.status === "banned") {
          toast.error("Ce compte est banni — publication interdite.");
          supabase.auth.signOut().then(() => navigate("/", { replace: true }));
        } else if (data?.status === "suspended") {
          toast.error("Ce compte est suspendu — publication temporairement bloquée.");
          navigate("/dashboard", { replace: true });
        }
      });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    supabase.from("categories").select("id, name").order("sort_order").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  // Restore draft (description + category + title/price/location) on mount
  const draftKey = user ? `publish-draft:${user.id}` : null;
  useEffect(() => {
    if (!draftKey || draftLoadedRef.current) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw);
        setForm((f) => ({ ...f, ...saved }));
        toast.info("Brouillon restauré");
      }
    } catch {}
    draftLoadedRef.current = true;
  }, [draftKey]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (!draftKey || !draftLoadedRef.current) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            title: form.title,
            description: form.description,
            price: form.price,
            location: form.location,
            category_id: form.category_id,
          }),
        );
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
  }, [draftKey, form.title, form.description, form.price, form.location, form.category_id]);


  const uploadPhoto = async (id: string, file: File) => {
    if (!user) return;
    cancelledRef.current.delete(id);
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "uploading", error: undefined } : p)),
    );
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file);
    // If user cancelled while upload was in flight, ignore the result
    if (cancelledRef.current.has(id)) {
      cancelledRef.current.delete(id);
      // Best-effort cleanup if it actually got uploaded
      if (!error) supabase.storage.from("listing-photos").remove([path]).catch(() => {});
      return;
    }
    if (error) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "error", error: error.message } : p)),
      );
      return;
    }
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "done", url: data.publicUrl } : p)),
    );
  };

  const cancelUpload = (id: string, mode: "keep" | "remove" = "keep") => {
    cancelledRef.current.add(id);
    if (mode === "remove") {
      removeFile(id);
      return;
    }
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "pending", error: undefined, url: undefined } : p,
      ),
    );
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = MAX_GALLERY_IMAGES - photos.length;
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length > remaining) {
      toast.error(`Maximum ${MAX_GALLERY_IMAGES} photos par annonce.`);
    }
    const selected = incoming.slice(0, Math.max(0, remaining));
    const valid = selected.filter((f) => f.size <= 5 * 1024 * 1024 && f.type.startsWith("image/"));
    if (valid.length < selected.length) toast.error("Certaines images ont été ignorées (max 5MB, images uniquement)");
    const newItems: PhotoItem[] = valid.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      status: "pending",
    }));
    setPhotos((p) => [...p, ...newItems]);
    // Kick off uploads in background
    newItems.forEach((it) => void uploadPhoto(it.id, it.file));
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setPhotos((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found?.status === "uploading") cancelledRef.current.add(id);
      if (found?.preview.startsWith("blob:")) URL.revokeObjectURL(found.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const retryUpload = (id: string) => {
    const item = photos.find((p) => p.id === id);
    if (item) void uploadPhoto(id, item.file);
  };

  const replaceFile = (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024 || !file.type.startsWith("image/")) {
      toast.error("Image invalide (max 5MB, images uniquement)");
      return;
    }
    // Cancel any in-flight upload for this slot
    cancelledRef.current.add(id);
    const newPreview = URL.createObjectURL(file);
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.preview.startsWith("blob:")) URL.revokeObjectURL(p.preview);
        return { ...p, file, preview: newPreview, status: "pending", error: undefined, url: undefined };
      }),
    );
    void uploadPhoto(id, file);
  };

  const clearAllFiles = () => {
    photos.forEach((p) => p.preview.startsWith("blob:") && URL.revokeObjectURL(p.preview));
    setPhotos([]);
  };

  const validateForm = (): boolean => {
    const result = schema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return false;
    }
    if (photos.length === 0) {
      toast.error("Ajoutez au moins une photo");
      return false;
    }
    if (photos.some((p) => p.status === "uploading" || p.status === "pending")) {
      toast.error("Patientez la fin de l'upload des photos");
      return false;
    }
    if (photos.some((p) => p.status === "error")) {
      toast.error("Corrigez les photos en erreur ou supprimez-les");
      return false;
    }
    return true;
  };

  const publishListing = async (premiumRequested: boolean) => {
    if (!user) return;
    setBusy(true);
    const uploadedUrls = photos.map((p) => p.url!).filter(Boolean);

    // Ensure the user's profile exists (older sessions may predate the profile trigger).
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name:
          (user.user_metadata as any)?.full_name ||
          (user.user_metadata as any)?.name ||
          user.email?.split("@")[0] ||
          "Utilisateur",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    // Premium is NEVER activated at publish time. It is only activated
    // by an admin once the payment is confirmed. Until then, the listing
    // is published as a standard ad.
    const { data: inserted, error } = await supabase
      .from("listings")
      .insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.price ? parseFloat(form.price) : null,
        location: form.location.trim() || null,
        category_id: form.category_id,
        images: uploadedUrls,
        is_premium: false,
      })
      .select()
      .single();

    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    if (premiumRequested) {
      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        listing_id: inserted.id,
        amount: PREMIUM_PRICE_FCFA,
        currency: "FCFA",
        type: "listing_boost",
        status: "pending",
        metadata: { duration_days: PREMIUM_DURATION_DAYS },
      });
      setBusy(false);
      if (txErr) {
        toast.warning("Annonce publiée. Demande Premium non enregistrée : " + txErr.message);
      } else {
        toast.success(
          `Annonce publiée ! Le Premium s'activera après confirmation du paiement (${PREMIUM_PRICE_FCFA.toLocaleString("fr-FR")} FCFA).`,
        );
      }
    } else {
      setBusy(false);
      toast.success("Annonce publiée !");
    }

    if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
    navigate(`/annonce/${inserted.id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateForm()) return;
    if (form.is_premium) {
      setConfirmPremiumOpen(true);
      return;
    }
    await publishListing(false);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Publier une annonce</h1>
        <p className="text-muted-foreground mb-8">Plus c'est complet, plus vite ça se vend.</p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-2xl p-6 md:p-8">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: iPhone 14 Pro Max 256 Go" maxLength={120} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie *</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger id="category"><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="description">Description *</Label>
              <div className="flex items-center gap-2">
                <select
                  value={aiLang}
                  onChange={(e) => setAiLang(e.target.value as "fr" | "en")}
                  className="text-xs bg-background border border-border rounded-md px-2 py-1"
                  aria-label="Langue IA"
                >
                  <option value="fr">FR</option>
                  <option value="en">EN</option>
                </select>
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={generateWithAI}
                  disabled={aiBusy || doneCount === 0}
                  className="h-8"
                >
                  {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {form.description ? "Régénérer avec IA" : "Générer avec IA"}
                </Button>
              </div>
            </div>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ajoutez vos photos puis cliquez « Générer avec IA » ✨ — ou décrivez vous-même l'état, l'âge, les caractéristiques..." rows={6} maxLength={2000} required />
            {aiBusy && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>{aiPhase || (aiLang === "en" ? "Analyzing…" : "Analyse en cours…")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">{Math.round(aiProgress)}%</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={cancelAiGeneration}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      {aiLang === "en" ? "Cancel" : "Annuler"}
                    </Button>
                  </div>
                </div>
                <Progress value={aiProgress} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">
                  {aiLang === "en"
                    ? "The AI is reading your photos to write a professional description."
                    : "L'IA analyse vos photos pour rédiger une description professionnelle."}
                </p>
              </div>
            )}
            {!aiBusy && aiError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2"
              >
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{aiLang === "en" ? "AI generation failed" : "Échec de la génération IA"}</p>
                    <p className="text-xs opacity-90 mt-0.5">{aiError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="gold" size="sm" className="h-7" onClick={generateWithAI}>
                    <RotateCw className="w-3.5 h-3.5 mr-1" />
                    {aiLang === "en" ? "Retry" : "Réessayer"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setAiError(null)}
                  >
                    {aiLang === "en" ? "Dismiss" : "Ignorer"}
                  </Button>
                </div>
              </div>
            )}
            {!aiBusy && aiRejected.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <TriangleAlert className="w-3.5 h-3.5" />
                  {aiLang === "en"
                    ? `${aiRejected.length} photo(s) could not be analyzed`
                    : `${aiRejected.length} photo(s) n'ont pas pu être analysées`}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {aiRejected.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 bg-background border border-border rounded-md p-1.5 text-xs">
                      <img src={r.url} alt="" className="w-8 h-8 rounded object-cover" />
                      <span className="text-muted-foreground max-w-[140px] truncate" title={r.reason}>{r.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {doneCount === 0 && (
              <p className="text-xs text-muted-foreground">Astuce : ajoutez au moins une photo pour activer la génération IA.</p>
            )}
          </div>



          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Prix (FCFA)</Label>
              <Input id="price" type="number" min="0" step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Vide = À discuter" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Localité</Label>
              <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: Dakar, Almadies" maxLength={100} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Label>Photos * (max {MAX_GALLERY_IMAGES}, 5MB chacune)</Label>
              <div className="flex items-center gap-3">
                <span
                  className={
                    "text-xs font-medium tabular-nums " +
                    (photos.length >= MAX_GALLERY_IMAGES ? "text-destructive" : "text-muted-foreground")
                  }
                  aria-live="polite"
                >
                  {doneCount} / {photos.length || MAX_GALLERY_IMAGES} envoyée{doneCount > 1 ? "s" : ""}
                  {uploadingCount > 0 && ` · ${uploadingCount} en cours`}
                  {errorCount > 0 && ` · ${errorCount} en erreur`}
                </span>
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
                  >
                    Tout supprimer
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div key={p.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Status overlay */}
                  {(p.status === "uploading" || p.status === "pending") && (
                    <div className="absolute inset-0 bg-background/65 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 text-xs font-medium px-2 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span>{p.status === "pending" ? "En attente…" : "Envoi…"}</span>
                      {p.status === "uploading" && (
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => cancelUpload(p.id, "keep")}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground/80 hover:text-destructive underline underline-offset-2"
                            aria-label="Annuler l'envoi"
                          >
                            <X className="w-3 h-3" /> Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelUpload(p.id, "remove")}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground/80 hover:text-destructive underline underline-offset-2"
                            aria-label="Annuler et retirer la photo"
                          >
                            <Trash2 className="w-3 h-3" /> Retirer
                          </button>
                        </div>
                      )}
                      {p.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => retryUpload(p.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold underline underline-offset-2"
                        >
                          <RotateCw className="w-3 h-3" /> Démarrer
                        </button>
                      )}
                    </div>
                  )}
                  {p.status === "error" && (
                    <div className="absolute inset-0 bg-destructive/85 text-destructive-foreground flex flex-col items-center justify-center gap-1 p-2 text-center">
                      <TriangleAlert className="w-5 h-5" />
                      <span className="text-[10px] leading-tight line-clamp-2">{p.error || "Échec"}</span>
                      <button
                        type="button"
                        onClick={() => retryUpload(p.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold underline underline-offset-2"
                      >
                        <RotateCw className="w-3 h-3" /> Réessayer
                      </button>
                    </div>
                  )}
                  {p.status === "done" && (
                    <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                      <Check className="w-3 h-3" />
                    </span>
                  )}

                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground rounded px-1.5 py-0.5">
                      Couverture
                    </span>
                  )}
                  <div className="absolute top-1 right-1 flex items-center gap-1">
                    <label
                      aria-label={`Modifier la photo ${i + 1}`}
                      title="Modifier la photo"
                      className="w-7 h-7 rounded-full bg-background/95 shadow-sm border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) replaceFile(p.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFile(p.id)}
                      aria-label={`Supprimer la photo ${i + 1}`}
                      className="w-7 h-7 rounded-full bg-background/95 shadow-sm border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {photos.length < MAX_GALLERY_IMAGES && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                  <ImagePlus className="w-6 h-6 mb-1" />
                  <span className="text-xs">Ajouter</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
                </label>
              )}
            </div>
          </div>

          <div
            className={
              "rounded-xl border p-5 transition-colors " +
              (form.is_premium
                ? "border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                : "border-border bg-card")
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 fill-primary" />
                </div>
                <div>
                  <Label htmlFor="premium" className="font-semibold text-base flex items-center gap-2">
                    Annonce Premium
                    <span className="text-xs font-normal text-muted-foreground">
                      {PREMIUM_PRICE_FCFA.toLocaleString("fr-FR")} FCFA · {PREMIUM_DURATION_DAYS} jours
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Boostez la visibilité de votre annonce et vendez plus vite.
                  </p>
                </div>
              </div>
              <Switch
                id="premium"
                checked={form.is_premium}
                onCheckedChange={(c) => setForm({ ...form, is_premium: c })}
              />
            </div>

            <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
              <li className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Badge doré « Premium » bien visible</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Mise en avant en haut des résultats</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Jusqu'à 5× plus de vues</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Affichage sur la page d'accueil</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outlineGold" onClick={() => navigate(-1)} className="flex-1">Annuler</Button>
            <Button type="submit" variant="gold" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {form.is_premium
                ? `Publier en Premium · ${PREMIUM_PRICE_FCFA.toLocaleString("fr-FR")} FCFA`
                : "Publier l'annonce"}
            </Button>
          </div>
        </form>

        <AlertDialog open={confirmPremiumOpen} onOpenChange={setConfirmPremiumOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary fill-primary" />
                Confirmer la publication Premium
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    Vous êtes sur le point de publier une annonce <strong>Premium</strong> pour{" "}
                    <strong>{PREMIUM_PRICE_FCFA.toLocaleString("fr-FR")} FCFA</strong> pendant{" "}
                    <strong>{PREMIUM_DURATION_DAYS} jours</strong>.
                  </p>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="font-semibold text-foreground mb-2">Avantages inclus :</p>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>Badge doré « Premium »</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>Mise en avant dans les résultats</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>Affichage prioritaire sur la page d'accueil</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Votre annonce sera publiée immédiatement en standard. Le badge Premium
                    et la mise en avant seront activés <strong>uniquement après confirmation
                    du paiement</strong>. Vous pouvez aussi publier sans Premium.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Modifier</AlertDialogCancel>
              <Button
                variant="outlineGold"
                disabled={busy}
                onClick={async () => {
                  setForm((f) => ({ ...f, is_premium: false }));
                  setConfirmPremiumOpen(false);
                  await publishListing(false);
                }}
              >
                Publier sans Premium
              </Button>
              <AlertDialogAction
                disabled={busy}
                onClick={async (e) => {
                  e.preventDefault();
                  setConfirmPremiumOpen(false);
                  await publishListing(true);
                }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                Confirmer ({PREMIUM_PRICE_FCFA.toLocaleString("fr-FR")} FCFA)
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!aiPreview} onOpenChange={(o) => { if (!o) setAiPreview(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                {aiLang === "en" ? "Preview AI description" : "Aperçu de la description IA"}
              </DialogTitle>
              <DialogDescription>
                {aiLang === "en"
                  ? "Compare your current text with the AI-generated version before replacing."
                  : "Comparez votre texte actuel avec la version générée par l'IA avant de remplacer."}
              </DialogDescription>
            </DialogHeader>
            {aiPreview && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {aiLang === "en" ? "Current" : "Actuel"}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap min-h-[160px] max-h-[40vh] overflow-auto">
                    {form.description?.trim() || (
                      <span className="italic text-muted-foreground">
                        {aiLang === "en" ? "(empty)" : "(vide)"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-primary uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {aiLang === "en" ? "AI proposal" : "Proposition IA"}
                  </div>
                  {aiPreview.title && !form.title && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {aiLang === "en" ? "Suggested title: " : "Titre suggéré : "}
                      </span>
                      {aiPreview.title}
                    </div>
                  )}
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm whitespace-pre-wrap min-h-[160px] max-h-[40vh] overflow-auto">
                    {aiPreview.description}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setAiPreview(null)}>
                {aiLang === "en" ? "Keep current" : "Garder l'actuel"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setAiPreview(null); void generateWithAI(); }}
              >
                <RotateCw className="w-4 h-4 mr-1.5" />
                {aiLang === "en" ? "Regenerate" : "Régénérer"}
              </Button>
              <Button variant="gold" onClick={acceptAiPreview}>
                <Check className="w-4 h-4 mr-1.5" />
                {aiLang === "en" ? "Use this description" : "Utiliser cette description"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


      </main>
      <Footer />
    </div>
  );
};

export default PublishListing;
