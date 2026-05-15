import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ImagePlus, Check } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ListingLite {
  id: string;
  title: string;
  description?: string | null;
  price: number | null;
  currency: string;
  images: string[];
  category_id?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listing: ListingLite | null;
  onSaved?: (updated: ListingLite) => void;
}

const MAX_IMAGES = 8;
const MAX_FILE = 5 * 1024 * 1024;

const schema = z.object({
  title: z.string().trim().min(3, "Titre trop court").max(120, "Titre trop long"),
  description: z.string().trim().min(10, "Description trop courte").max(2000, "Description trop longue"),
  price: z.string().trim().max(15).optional(),
  category_id: z.string().uuid("Catégorie requise"),
});

const EditListingDialog = ({ open, onOpenChange, listing, onSaved }: Props) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("categories").select("id,name").order("name").then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, [open]);

  useEffect(() => {
    if (!listing) return;
    setTitle(listing.title ?? "");
    setDescription(listing.description ?? "");
    setPrice(listing.price != null ? String(listing.price) : "");
    setCategoryId(listing.category_id ?? "");
    setImages(listing.images ?? []);
  }, [listing]);

  const handleAddImages = async (files: FileList | null) => {
    if (!files || !user) return;
    const remaining = MAX_IMAGES - images.length;
    const list = Array.from(files).slice(0, Math.max(0, remaining));
    const valid = list.filter((f) => f.size <= MAX_FILE && f.type.startsWith("image/"));
    if (valid.length < list.length) toast.error("Certaines images ignorées (max 5 Mo, images uniquement)");
    if (valid.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of valid) {
      const ext = f.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("listing-photos").upload(path, f);
      if (!error) {
        const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
    }
    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
  };

  const handleSave = async () => {
    if (!listing) return;
    const parsed = schema.safeParse({ title, description, price, category_id: categoryId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (images.length === 0) {
      toast.error("Ajoutez au moins une photo");
      return;
    }
    setSaving(true);
    const priceNum = price.trim() === "" ? null : Number(price);
    if (price.trim() !== "" && (Number.isNaN(priceNum) || (priceNum as number) < 0)) {
      setSaving(false);
      toast.error("Prix invalide");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: priceNum,
      category_id: categoryId,
      images,
    };
    const { data, error } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", listing.id)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Échec de la mise à jour : " + error.message);
      return;
    }
    toast.success("Annonce mise à jour");
    onSaved?.((data ?? { ...listing, ...payload }) as ListingLite);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'annonce</DialogTitle>
          <DialogDescription>Mettez à jour les informations puis enregistrez.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Titre *</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Prix ({listing?.currency ?? "FCFA"})</Label>
              <Input id="edit-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Laissez vide pour « À discuter »" />
            </div>
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description *</Label>
            <Textarea id="edit-desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Photos ({images.length}/{MAX_IMAGES})</Label>
              {uploading && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Envoi…</span>}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] font-semibold uppercase bg-primary text-primary-foreground rounded px-1.5 py-0.5">Couverture</span>}
                  <button type="button" onClick={() => removeImage(url)} aria-label="Supprimer" className="absolute top-1 right-1 w-7 h-7 rounded-full bg-background/95 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary">
                  <ImagePlus className="w-6 h-6 mb-1" />
                  <span className="text-[11px] font-medium">Ajouter</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleAddImages(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button variant="gold" onClick={handleSave} disabled={saving || uploading}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : <><Check className="w-4 h-4" /> Enregistrer les modifications</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditListingDialog;
