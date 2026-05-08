import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, Save, Upload, User as UserIcon, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const schema = z.object({
  display_name: z.string().trim().min(2, "Nom trop court").max(80, "Nom trop long"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  account_type: z.enum(["particulier", "professionnel"]),
});

type ProfileForm = z.infer<typeof schema>;

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    display_name: "",
    phone: "",
    whatsapp: "",
    city: "",
    account_type: "particulier",
  });
  const [confirmText, setConfirmText] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const onDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: confirmText, email: confirmEmail },
    });
    setDeleting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Suppression impossible");
      return;
    }
    toast.success("Compte supprimé");
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, phone, whatsapp, city, account_type, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          phone: data.phone ?? "",
          whatsapp: data.whatsapp ?? "",
          city: data.city ?? "",
          account_type: (data.account_type as "particulier" | "professionnel") ?? "particulier",
        });
        setAvatarUrl(data.avatar_url);
      }
      setBusy(false);
    })();
  }, [user]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        phone: parsed.data.phone || null,
        whatsapp: parsed.data.whatsapp || null,
        city: parsed.data.city || null,
        account_type: parsed.data.account_type,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
  };

  const onAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("Image trop lourde (max 3 Mo)");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("listing-photos").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { data: pub } = supabase.storage.from("listing-photos").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    setAvatarUrl(url);
    toast.success("Photo mise à jour");
  };

  if (loading || !user || busy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Mon profil</h1>
        <p className="text-muted-foreground mb-8">Gérez vos informations personnelles</p>

        <form onSubmit={onSave} className="space-y-6 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-5">
            <Avatar className="w-20 h-20">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback><UserIcon className="w-8 h-8" /></AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md border border-input hover:bg-accent">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Changer la photo
                </div>
                <input id="avatar" type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} disabled={uploading} />
              </Label>
              <p className="text-xs text-muted-foreground mt-1">JPG ou PNG, max 3 Mo</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email ?? ""} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Nom affiché *</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              maxLength={80}
              required
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                maxLength={30}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_type">Type de compte</Label>
            <Select
              value={form.account_type}
              onValueChange={(v) => setForm({ ...form, account_type: v as "particulier" | "professionnel" })}
            >
              <SelectTrigger id="account_type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="particulier">Particulier</SelectItem>
                <SelectItem value="professionnel">Professionnel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="gold" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </Button>
            <Button type="button" variant="outlineGold" onClick={() => navigate("/dashboard")}>
              Retour
            </Button>
          </div>
        </form>

        <div className="mt-10 bg-card border border-destructive/40 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <h2 className="font-display text-xl font-bold text-destructive">Zone dangereuse</h2>
              <p className="text-sm text-muted-foreground mt-1">
                La suppression de votre compte est <strong>définitive</strong>. Vos annonces, messages
                et favoris seront effacés et ne pourront pas être récupérés.
              </p>
            </div>
          </div>

          <AlertDialog
            onOpenChange={(open) => {
              if (!open) {
                setConfirmText("");
                setConfirmEmail("");
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="mt-2">
                <Trash2 className="w-4 h-4" />
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est <strong>irréversible</strong>. Pour confirmer, saisissez votre email
                  et tapez <strong>SUPPRIMER</strong> en majuscules.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="confirm_email">Votre email</Label>
                  <Input
                    id="confirm_email"
                    type="email"
                    placeholder={user.email ?? ""}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_text">Tapez SUPPRIMER</Label>
                  <Input
                    id="confirm_text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="SUPPRIMER"
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    deleting ||
                    confirmText !== "SUPPRIMER" ||
                    confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    onDeleteAccount();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
