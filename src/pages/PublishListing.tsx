import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Check, ImagePlus, Loader2, RotateCw, Trash2, TriangleAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { MAX_GALLERY_IMAGES } from "@/components/ImageGallery";

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

  const clearAllFiles = () => {
    photos.forEach((p) => p.preview.startsWith("blob:") && URL.revokeObjectURL(p.preview));
    setPhotos([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const result = schema.safeParse(form);
    if (!result.success) return toast.error(result.error.issues[0].message);
    if (photos.length === 0) return toast.error("Ajoutez au moins une photo");
    if (photos.some((p) => p.status === "uploading" || p.status === "pending")) {
      return toast.error("Patientez la fin de l'upload des photos");
    }
    if (photos.some((p) => p.status === "error")) {
      return toast.error("Corrigez les photos en erreur ou supprimez-les");
    }

    setBusy(true);
    const uploadedUrls = photos.map((p) => p.url!).filter(Boolean);

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
        is_premium: form.is_premium,
      })
      .select()
      .single();

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Annonce publiée !");
    navigate(`/annonce/${inserted.id}`);
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
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Décrivez l'état, l'âge, les caractéristiques..." rows={6} maxLength={2000} required />
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
                  <button
                    type="button"
                    onClick={() => removeFile(p.id)}
                    aria-label={`Supprimer la photo ${i + 1}`}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-background/95 shadow-sm border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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

          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/30">
            <div>
              <Label htmlFor="premium" className="font-semibold">Annonce Premium ⭐</Label>
              <p className="text-xs text-muted-foreground mt-1">Mise en avant et badge doré</p>
            </div>
            <Switch id="premium" checked={form.is_premium} onCheckedChange={(c) => setForm({ ...form, is_premium: c })} />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outlineGold" onClick={() => navigate(-1)} className="flex-1">Annuler</Button>
            <Button type="submit" variant="gold" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Publier l'annonce
            </Button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default PublishListing;
