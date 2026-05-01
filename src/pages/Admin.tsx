import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, Trash2, Star, Eye, EyeOff, Plus, Pencil } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Listing = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  is_active: boolean;
  is_premium: boolean;
  user_id: string;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
};

type Profile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  account_type: string;
  created_at: string;
};

type RoleRow = { user_id: string; role: string };

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", icon: "", description: "", sort_order: 0 });

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Accès refusé : réservé aux administrateurs.");
      navigate("/");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  const loadData = async () => {
    setLoadingData(true);
    const [l, c, p, r] = await Promise.all([
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (l.data) setListings(l.data as Listing[]);
    if (c.data) setCategories(c.data as Category[]);
    if (p.data) setProfiles(p.data as Profile[]);
    if (r.data) setRoles(r.data as RoleRow[]);
    setLoadingData(false);
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  // === Listings actions ===
  const toggleActive = async (l: Listing) => {
    const { error } = await supabase.from("listings").update({ is_active: !l.is_active }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(l.is_active ? "Annonce désactivée" : "Annonce activée");
    loadData();
  };
  const togglePremium = async (l: Listing) => {
    const { error } = await supabase.from("listings").update({ is_premium: !l.is_premium }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Statut premium mis à jour");
    loadData();
  };
  const deleteListing = async (id: string) => {
    if (!confirm("Supprimer définitivement cette annonce ?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Annonce supprimée");
    loadData();
  };

  // === Categories ===
  const openCatDialog = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, slug: cat.slug, icon: cat.icon ?? "", description: cat.description ?? "", sort_order: cat.sort_order });
    } else {
      setEditingCat(null);
      setCatForm({ name: "", slug: "", icon: "", description: "", sort_order: 0 });
    }
    setCatDialog(true);
  };
  const saveCat = async () => {
    if (!catForm.name || !catForm.slug) return toast.error("Nom et slug requis");
    const payload = {
      name: catForm.name,
      slug: catForm.slug,
      icon: catForm.icon || null,
      description: catForm.description || null,
      sort_order: Number(catForm.sort_order) || 0,
    };
    const { error } = editingCat
      ? await supabase.from("categories").update(payload).eq("id", editingCat.id)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingCat ? "Catégorie mise à jour" : "Catégorie créée");
    setCatDialog(false);
    loadData();
  };
  const deleteCat = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Catégorie supprimée");
    loadData();
  };

  // === Users / roles ===
  const isUserAdmin = (uid: string) => roles.some((r) => r.user_id === uid && r.role === "admin");
  const toggleAdmin = async (uid: string) => {
    if (uid === user?.id && isUserAdmin(uid)) {
      if (!confirm("Vous allez retirer votre propre accès admin. Continuer ?")) return;
    }
    if (isUserAdmin(uid)) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Rôle admin retiré");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Rôle admin attribué");
    }
    loadData();
  };

  if (authLoading || adminLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Panneau d'administration</h1>
            <p className="text-sm text-muted-foreground">Gérez votre plateforme en toute sécurité</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Annonces</div><div className="text-2xl font-bold">{listings.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Actives</div><div className="text-2xl font-bold text-primary">{listings.filter(l=>l.is_active).length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Catégories</div><div className="text-2xl font-bold">{categories.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Utilisateurs</div><div className="text-2xl font-bold">{profiles.length}</div></Card>
        </div>

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="listings">Annonces</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingData ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : listings.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium max-w-[300px] truncate">{l.title}</TableCell>
                        <TableCell>{l.price ? `${l.price} ${l.currency}` : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Actif" : "Inactif"}</Badge>
                            {l.is_premium && <Badge className="bg-primary text-primary-foreground">Premium</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => togglePremium(l)} title="Premium">
                              <Star className={`w-4 h-4 ${l.is_premium ? "fill-primary text-primary" : ""}`} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleActive(l)} title={l.is_active ? "Désactiver" : "Activer"}>
                              {l.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteListing(l.id)} title="Supprimer">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <div className="flex justify-end mb-4">
              <Button variant="gold" onClick={() => openCatDialog()}><Plus className="w-4 h-4" /> Nouvelle catégorie</Button>
            </div>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Icône</TableHead>
                    <TableHead>Ordre</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                      <TableCell>{c.icon ?? "-"}</TableCell>
                      <TableCell>{c.sort_order}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openCatDialog(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteCat(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.display_name ?? "—"}</TableCell>
                        <TableCell>{p.phone ?? "—"}</TableCell>
                        <TableCell>{p.city ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{p.account_type}</Badge></TableCell>
                        <TableCell>
                          {isUserAdmin(p.id) ? <Badge className="bg-primary text-primary-foreground">Admin</Badge> : <Badge variant="secondary">Utilisateur</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={isUserAdmin(p.id) ? "outline" : "gold"} onClick={() => toggleAdmin(p.id)}>
                            {isUserAdmin(p.id) ? "Retirer admin" : "Promouvoir admin"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} placeholder="ex: vehicules" /></div>
            <div><Label>Icône (emoji ou nom)</Label><Input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} /></div>
            <div><Label>Ordre d'affichage</Label><Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCatDialog(false)}>Annuler</Button>
            <Button variant="gold" onClick={saveCat}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
