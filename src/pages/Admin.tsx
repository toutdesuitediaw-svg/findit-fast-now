import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Shield, Trash2, Star, Eye, EyeOff, Plus, Pencil,
  LayoutDashboard, Users, Megaphone, AlertTriangle, FolderTree,
  CreditCard, Settings as SettingsIcon, ShieldCheck, ShieldOff, BadgeCheck,
  History, CheckCircle2, XCircle, ArrowLeft, LogOut, KeyRound, Mail, BarChart3, Sparkles,
} from "lucide-react";
import Header from "@/components/Header";
import PwaAnalyticsTab from "@/components/admin/PwaAnalyticsTab";
import ModerationAITab from "@/components/admin/ModerationAITab";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/activityLog";

type Listing = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  is_active: boolean;
  is_premium: boolean;
  is_featured: boolean;
  user_id: string;
  created_at: string;
  moderation_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
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
  status: "active" | "suspended" | "banned";
  is_verified: boolean;
  created_at: string;
};

type RoleRow = { user_id: string; role: string };

type Report = {
  id: string;
  reporter_id: string;
  target_type: "listing" | "user";
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  created_at: string;
};

type ActivityLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  type: string;
  method: string | null;
  status: string;
  created_at: string;
};

type Subscription = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  expires_at: string | null;
};

type SiteSetting = { key: string; value: unknown; description: string | null };

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [emails, setEmails] = useState<Record<string, string | null>>({});

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", icon: "", description: "", sort_order: 0 });

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<Listing | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Edit user dialog
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editUserForm, setEditUserForm] = useState({ display_name: "", email: "", phone: "" });
  const [savingUser, setSavingUser] = useState(false);

  // Reset password dialog
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [resetMode, setResetMode] = useState<"email" | "manual">("email");
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPwd, setResettingPwd] = useState(false);

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (!user) { navigate("/admin/login"); return; }
    if (!isAdmin) { toast.error("Accès refusé : réservé aux administrateurs."); navigate("/"); }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  const loadData = async () => {
    setLoadingData(true);
    const [l, c, p, r, rep, lg, tx, sub, st] = await Promise.all([
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("subscriptions").select("*"),
      supabase.from("site_settings").select("*"),
    ]);
    if (l.data) setListings(l.data as Listing[]);
    if (c.data) setCategories(c.data as Category[]);
    if (p.data) setProfiles(p.data as Profile[]);
    if (r.data) setRoles(r.data as RoleRow[]);
    if (rep.data) setReports(rep.data as Report[]);
    if (lg.data) setLogs(lg.data as ActivityLog[]);
    if (tx.data) setTransactions(tx.data as Transaction[]);
    if (sub.data) setSubscriptions(sub.data as Subscription[]);
    if (st.data) setSettings(st.data as SiteSetting[]);
    setLoadingData(false);

    // Fetch emails via secure admin function
    try {
      const { data: ed } = await supabase.functions.invoke("admin-users", { body: { action: "list" } });
      if (ed?.users) {
        const map: Record<string, string | null> = {};
        for (const u of ed.users as { id: string; email: string | null }[]) map[u.id] = u.email;
        setEmails(map);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  const log = (action: string, targetType?: string, targetId?: string | null, metadata?: Record<string, unknown>) => {
    if (user) logAdminAction({ adminId: user.id, action, targetType, targetId, metadata });
  };

  // === Dashboard stats ===
  const stats = useMemo(() => {
    const revenue = transactions
      .filter(t => t.status === "completed")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return {
      users: profiles.length,
      listings: listings.length,
      activeListings: listings.filter(l => l.is_active).length,
      pendingListings: listings.filter(l => l.moderation_status === "pending").length,
      openReports: reports.filter(r => r.status === "open").length,
      premium: subscriptions.filter(s => s.plan !== "free" && s.status === "active").length,
      revenue,
    };
  }, [profiles, listings, reports, subscriptions, transactions]);

  // === Listings ===
  const toggleActive = async (l: Listing) => {
    const { error } = await supabase.from("listings").update({ is_active: !l.is_active }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(l.is_active ? "Annonce désactivée" : "Annonce activée");
    log(l.is_active ? "listing.deactivate" : "listing.activate", "listing", l.id);
    loadData();
  };
  const togglePremium = async (l: Listing) => {
    const { error } = await supabase.from("listings").update({ is_premium: !l.is_premium }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Statut premium mis à jour");
    log("listing.toggle_premium", "listing", l.id, { is_premium: !l.is_premium });
    loadData();
  };
  const toggleFeatured = async (l: Listing) => {
    const { error } = await supabase.from("listings").update({ is_featured: !l.is_featured }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Mise en avant mise à jour");
    log("listing.toggle_featured", "listing", l.id, { is_featured: !l.is_featured });
    loadData();
  };
  const approveListing = async (l: Listing) => {
    const { error } = await supabase.from("listings")
      .update({ moderation_status: "approved", rejection_reason: null }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Annonce approuvée");
    log("listing.approve", "listing", l.id);
    loadData();
  };
  const submitReject = async () => {
    if (!rejectDialog) return;
    const { error } = await supabase.from("listings")
      .update({ moderation_status: "rejected", rejection_reason: rejectReason, is_active: false })
      .eq("id", rejectDialog.id);
    if (error) return toast.error(error.message);
    toast.success("Annonce refusée");
    log("listing.reject", "listing", rejectDialog.id, { reason: rejectReason });
    setRejectDialog(null);
    setRejectReason("");
    loadData();
  };
  const deleteListing = async (id: string) => {
    if (!confirm("Supprimer définitivement cette annonce ?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Annonce supprimée");
    log("listing.delete", "listing", id);
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
      name: catForm.name, slug: catForm.slug,
      icon: catForm.icon || null, description: catForm.description || null,
      sort_order: Number(catForm.sort_order) || 0,
    };
    const { error } = editingCat
      ? await supabase.from("categories").update(payload).eq("id", editingCat.id)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingCat ? "Catégorie mise à jour" : "Catégorie créée");
    log(editingCat ? "category.update" : "category.create", "category", editingCat?.id ?? null, payload);
    setCatDialog(false);
    loadData();
  };
  const deleteCat = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Catégorie supprimée");
    log("category.delete", "category", id);
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
      log("user.demote", "user", uid);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Rôle admin attribué");
      log("user.promote", "user", uid);
    }
    loadData();
  };
  const setUserStatus = async (uid: string, status: "active" | "suspended" | "banned") => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success(`Compte ${status === "active" ? "réactivé" : status === "suspended" ? "suspendu" : "banni"}`);
    log(`user.${status}`, "user", uid);
    loadData();
  };
  const toggleVerified = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ is_verified: !p.is_verified }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_verified ? "Vérification retirée" : "Identité vérifiée");
    log("user.verify", "user", p.id, { is_verified: !p.is_verified });
    loadData();
  };

  const openEditUser = (p: Profile) => {
    setEditUser(p);
    setEditUserForm({
      display_name: p.display_name ?? "",
      email: emails[p.id] ?? "",
      phone: p.phone ?? "",
    });
  };
  const saveEditUser = async () => {
    if (!editUser) return;
    const { display_name, email, phone } = editUserForm;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Email invalide");
    if (phone && !/^[+0-9 ()-]{6,20}$/.test(phone)) return toast.error("Téléphone invalide");
    setSavingUser(true);
    const emailChanged = email !== (emails[editUser.id] ?? "");
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "update",
        userId: editUser.id,
        display_name,
        phone,
        ...(emailChanged ? { email } : {}),
      },
    });
    setSavingUser(false);
    if (error || data?.error) return toast.error(data?.error ?? error?.message ?? "Erreur");
    toast.success("Utilisateur mis à jour");
    log("user.update", "user", editUser.id, { display_name, phone, emailChanged });
    setEditUser(null);
    loadData();
  };

  const openResetUser = (p: Profile) => {
    setResetUser(p);
    setResetMode("email");
    setResetPassword("");
  };
  const submitResetPassword = async () => {
    if (!resetUser) return;
    if (resetMode === "manual" && resetPassword.length < 8) {
      return toast.error("Mot de passe : 8 caractères minimum");
    }
    setResettingPwd(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "reset_password",
        userId: resetUser.id,
        mode: resetMode,
        ...(resetMode === "manual" ? { new_password: resetPassword } : {}),
      },
    });
    setResettingPwd(false);
    if (error || data?.error) return toast.error(data?.error ?? error?.message ?? "Erreur");
    toast.success(resetMode === "email" ? "Email de réinitialisation envoyé" : "Mot de passe réinitialisé");
    log("user.reset_password", "user", resetUser.id, { mode: resetMode });
    setResetUser(null);
  };

  const normalizeDeletionConfirmation = (value: string) =>
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

  const deleteUser = async (p: Profile) => {
    const label = p.display_name || emails[p.id] || p.id;
    if (!confirm(`⚠️ SUPPRESSION DÉFINITIVE\n\nVous êtes sur le point de supprimer définitivement le compte de "${label}".\n\nSeront supprimés sans possibilité de récupération :\n- Le profil et l'accès\n- Toutes les annonces et photos\n- Tous les messages\n- Tous les favoris, transactions et abonnements\n\nContinuer ?`)) return;
    const typed = prompt(`Pour confirmer la SUPPRESSION DÉFINITIVE du compte "${label}", tapez :\n\nsuppression definitive\n\n(les majuscules et accents ne sont pas obligatoires)`);
    if (typed === null) return;
    if (normalizeDeletionConfirmation(typed) !== "SUPPRESSION DEFINITIVE") {
      toast.error("Confirmation incorrecte. Suppression annulée.");
      return;
    }
    if (!confirm(`Dernière confirmation : supprimer DÉFINITIVEMENT "${label}" ? Cette action est irréversible.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "delete", userId: p.id },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Erreur lors de la suppression");
      } else {
        toast.success("Compte supprimé définitivement");
        log("user.delete", "user", p.id, { display_name: p.display_name });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      // Toujours rafraîchir la liste pour refléter l'état réel (actif/banni/supprimé)
      await loadData();
    }
  };


  const updateReport = async (id: string, status: Report["status"]) => {
    const { error } = await supabase.from("reports")
      .update({ status, resolved_by: user?.id, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Signalement mis à jour");
    log("report.update", "report", id, { status });
    loadData();
  };
  const deleteReport = async (id: string) => {
    if (!confirm("Supprimer ce signalement ?")) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Signalement supprimé");
    log("report.delete", "report", id);
    loadData();
  };

  // === Settings ===
  const updateSetting = async (key: string, raw: string) => {
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { value = raw; }
    const { error } = await supabase.from("site_settings")
      .update({ value: value as never, updated_by: user?.id }).eq("key", key);
    if (error) return toast.error(error.message);
    toast.success("Paramètre mis à jour");
    log("setting.update", "setting", null, { key, value });
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
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Panneau d'administration</h1>
              <p className="text-sm text-muted-foreground">Gestion complète de la plateforme</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour au site
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await signOut();
                toast.success("Déconnexion réussie");
                navigate("/admin/login", { replace: true });
              }}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" />Utilisateurs</TabsTrigger>
            <TabsTrigger value="listings"><Megaphone className="w-4 h-4 mr-1" />Annonces</TabsTrigger>
            <TabsTrigger value="moderation"><AlertTriangle className="w-4 h-4 mr-1" />Modération</TabsTrigger>
            <TabsTrigger value="ai-moderation"><Sparkles className="w-4 h-4 mr-1" />Modération IA</TabsTrigger>
            <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-1" />Paiements</TabsTrigger>
            <TabsTrigger value="categories"><FolderTree className="w-4 h-4 mr-1" />Catégories</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1" />Analytics PWA</TabsTrigger>
            <TabsTrigger value="settings"><SettingsIcon className="w-4 h-4 mr-1" />Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <PwaAnalyticsTab />
          </TabsContent>

          <TabsContent value="ai-moderation">
            <ModerationAITab />
          </TabsContent>

          {/* === DASHBOARD === */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4"><div className="text-xs text-muted-foreground">Utilisateurs</div><div className="text-2xl font-bold">{stats.users}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Annonces</div><div className="text-2xl font-bold">{stats.listings}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Actives</div><div className="text-2xl font-bold text-primary">{stats.activeListings}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">En attente</div><div className="text-2xl font-bold text-amber-500">{stats.pendingListings}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Signalements ouverts</div><div className="text-2xl font-bold text-destructive">{stats.openReports}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Abonnés premium</div><div className="text-2xl font-bold">{stats.premium}</div></Card>
              <Card className="p-4 col-span-2"><div className="text-xs text-muted-foreground">Revenus (complétés)</div><div className="text-2xl font-bold text-primary">{stats.revenue.toLocaleString()} FCFA</div></Card>
            </div>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><History className="w-4 h-4" /><h3 className="font-semibold">Activité admin récente</h3></div>
              <div className="space-y-1 max-h-80 overflow-y-auto text-sm">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground text-center py-4">Aucune activité</div>
                ) : logs.slice(0, 30).map(lg => (
                  <div key={lg.id} className="flex justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                    <span className="font-mono text-xs">{lg.action}</span>
                    <span className="text-muted-foreground text-xs">{new Date(lg.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* === USERS === */}
          <TabsContent value="users">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Inscription</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...profiles]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {p.display_name ?? "—"}
                            {p.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.city ?? ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">{emails[p.id] ?? "—"}</TableCell>
                         <TableCell>{p.phone ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(p.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : p.status === "suspended" ? "secondary" : "destructive"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isUserAdmin(p.id) ? <Badge className="bg-primary text-primary-foreground">Admin</Badge> : <Badge variant="outline">{p.account_type}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => openEditUser(p)} title="Modifier" className="gap-1">
                              <Pencil className="w-3.5 h-3.5" /> Modifier
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openResetUser(p)} title="Réinitialiser mot de passe" className="gap-1">
                              <KeyRound className="w-3.5 h-3.5" /> Mot de passe
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleVerified(p)} title="Vérifier identité">
                              <BadgeCheck className={`w-4 h-4 ${p.is_verified ? "text-primary" : ""}`} />
                            </Button>
                            {p.status !== "suspended" ? (
                              <Button size="sm" variant="ghost" onClick={() => setUserStatus(p.id, "suspended")} title="Suspendre">
                                <ShieldOff className="w-4 h-4 text-amber-500" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setUserStatus(p.id, "active")} title="Réactiver">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                              </Button>
                            )}
                            {p.status !== "banned" ? (
                              <Button size="sm" variant="ghost" onClick={() => setUserStatus(p.id, "banned")} title="Bannir sans supprimer">
                                <ShieldOff className="w-4 h-4 text-destructive" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setUserStatus(p.id, "active")} title="Débannir">
                                <ShieldCheck className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="sm" variant={isUserAdmin(p.id) ? "outline" : "gold"} onClick={() => toggleAdmin(p.id)}>
                              {isUserAdmin(p.id) ? "Retirer admin" : "Promouvoir"}
                            </Button>
                            {!isUserAdmin(p.id) && p.id !== user?.id && (
                              <Button size="sm" variant="destructive" onClick={() => deleteUser(p)} title="Supprimer définitivement" className="gap-1">
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* === LISTINGS === */}
          <TabsContent value="listings">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Modération</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingData ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : listings.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium max-w-[280px] truncate">{l.title}</TableCell>
                        <TableCell>{l.price ? `${l.price} ${l.currency}` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={l.moderation_status === "approved" ? "default" : l.moderation_status === "pending" ? "secondary" : "destructive"}>
                            {l.moderation_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Actif" : "Inactif"}</Badge>
                            {l.is_premium && <Badge className="bg-primary text-primary-foreground">Premium</Badge>}
                            {l.is_featured && <Badge className="bg-amber-500 text-white">À la une</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {l.moderation_status !== "approved" && (
                              <Button size="sm" variant="ghost" onClick={() => approveListing(l)} title="Approuver">
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              </Button>
                            )}
                            {l.moderation_status !== "rejected" && (
                              <Button size="sm" variant="ghost" onClick={() => { setRejectDialog(l); setRejectReason(""); }} title="Refuser">
                                <XCircle className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => toggleFeatured(l)} title="Mettre en avant">
                              <Star className={`w-4 h-4 ${l.is_featured ? "fill-amber-500 text-amber-500" : ""}`} />
                            </Button>
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

          {/* === MODERATION === */}
          <TabsContent value="moderation">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" />Signalements</h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {reports.length === 0 ? (
                    <div className="text-muted-foreground text-center py-6 text-sm">Aucun signalement</div>
                  ) : reports.map(r => (
                    <div key={r.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{r.target_type}</Badge>
                            <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
                          </div>
                          <div className="font-medium mt-1 text-sm">{r.reason}</div>
                          {r.details && <div className="text-xs text-muted-foreground mt-1">{r.details}</div>}
                          <div className="text-xs text-muted-foreground mt-1 font-mono truncate">cible: {r.target_id}</div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => updateReport(r.id, "reviewed")}>Examiné</Button>
                        <Button size="sm" variant="outline" onClick={() => updateReport(r.id, "actioned")}>Action prise</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReport(r.id, "dismissed")}>Rejeter</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteReport(r.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" />Logs d'activité</h3>
                <div className="space-y-1 max-h-[600px] overflow-y-auto text-sm">
                  {logs.map(lg => (
                    <div key={lg.id} className="py-2 border-b border-border/50 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-mono text-xs">{lg.action}</span>
                        <span className="text-muted-foreground text-xs">{new Date(lg.created_at).toLocaleString("fr-FR")}</span>
                      </div>
                      {lg.target_id && <div className="text-xs text-muted-foreground font-mono truncate">{lg.target_type}: {lg.target_id}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* === PAYMENTS === */}
          <TabsContent value="payments">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4"><div className="text-xs text-muted-foreground">Transactions</div><div className="text-2xl font-bold">{transactions.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Revenus complétés</div><div className="text-2xl font-bold text-primary">{stats.revenue.toLocaleString()} FCFA</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Abonnés premium</div><div className="text-2xl font-bold">{stats.premium}</div></Card>
            </div>
            <Card className="p-4 mb-4 bg-muted/30 border-dashed">
              <p className="text-sm text-muted-foreground">
                💡 La structure de paiement est prête (Wave, Orange Money, MTN, commissions, abonnements).
                L'intégration avec un fournisseur de paiement mobile money pourra être ajoutée ultérieurement.
              </p>
            </Card>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune transaction</TableCell></TableRow>
                    ) : transactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-FR")}</TableCell>
                        <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                        <TableCell>{t.method ?? "—"}</TableCell>
                        <TableCell className="font-medium">{Number(t.amount).toLocaleString()} {t.currency}</TableCell>
                        <TableCell><Badge variant={t.status === "completed" ? "default" : t.status === "failed" ? "destructive" : "secondary"}>{t.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* === CATEGORIES === */}
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

          {/* === SETTINGS === */}
          <TabsContent value="settings">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Paramètres du site</h3>
                <div className="space-y-4">
                  {settings.map(s => (
                    <SettingRow key={s.key} setting={s} onSave={updateSetting} />
                  ))}
                </div>
              </Card>
              <ChangeAdminPasswordCard />
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />

      {/* Category dialog */}
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

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser l'annonce</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rejectDialog?.title}</p>
            <div>
              <Label>Motif du refus</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Expliquez pourquoi cette annonce est refusée..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={submitReject} disabled={!rejectReason.trim()}>Refuser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom</Label>
              <Input value={editUserForm.display_name} onChange={(e) => setEditUserForm({ ...editUserForm, display_name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input type="tel" value={editUserForm.phone} onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })} placeholder="+225 ..." />
            </div>
            <p className="text-xs text-muted-foreground">Le mot de passe ne s'affiche jamais. Utilisez « Mot de passe » pour le réinitialiser.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button variant="gold" onClick={saveEditUser} disabled={savingUser}>
              {savingUser && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pour <span className="font-medium text-foreground">{resetUser?.display_name ?? emails[resetUser?.id ?? ""] ?? "cet utilisateur"}</span>.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant={resetMode === "email" ? "gold" : "outline"} onClick={() => setResetMode("email")} className="gap-1">
                <Mail className="w-4 h-4" /> Envoyer un email
              </Button>
              <Button size="sm" variant={resetMode === "manual" ? "gold" : "outline"} onClick={() => setResetMode("manual")} className="gap-1">
                <KeyRound className="w-4 h-4" /> Définir manuellement
              </Button>
            </div>
            {resetMode === "manual" ? (
              <div>
                <Label>Nouveau mot de passe (8 car. min.)</Label>
                <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoComplete="new-password" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Un email contenant un lien de réinitialisation sera envoyé à l'adresse de l'utilisateur.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetUser(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => { if (confirm("Confirmer la réinitialisation du mot de passe ?")) submitResetPassword(); }}
              disabled={resettingPwd}
            >
              {resettingPwd && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SettingRow = ({ setting, onSave }: { setting: SiteSetting; onSave: (k: string, v: string) => void }) => {
  const [value, setValue] = useState(typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value));
  return (
    <div className="grid md:grid-cols-3 gap-3 items-start border-b border-border/50 pb-4 last:border-0">
      <div>
        <div className="font-medium text-sm">{setting.key}</div>
        {setting.description && <div className="text-xs text-muted-foreground">{setting.description}</div>}
      </div>
      <div className="md:col-span-2 flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
        <Button variant="gold" size="sm" onClick={() => onSave(setting.key, value)}>Enregistrer</Button>
      </div>
    </div>
  );
};

const ChangeAdminPasswordCard = () => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (next !== confirmPwd) { toast.error("Les nouveaux mots de passe ne correspondent pas"); return; }
    if (next.length < 12) { toast.error("12 caractères minimum"); return; }
    if (!/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next) || !/[^A-Za-z0-9]/.test(next)) {
      toast.error("Doit contenir majuscule, minuscule, chiffre et caractère spécial"); return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("change-admin-password", {
      body: { currentPassword: current, newPassword: next },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Échec de la modification");
      return;
    }
    toast.success("Mot de passe modifié avec succès");
    setCurrent(""); setNext(""); setConfirmPwd("");
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-1 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Changer mon mot de passe</h3>
      <p className="text-xs text-muted-foreground mb-4">Pour la sécurité, votre mot de passe actuel est requis.</p>
      <div className="space-y-3">
        <div>
          <Label>Mot de passe actuel</Label>
          <Input type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <Label>Nouveau mot de passe</Label>
          <Input type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <Label>Confirmer le nouveau mot de passe</Label>
          <Input type={show ? "text" : "password"} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShow(!show)} className="gap-1">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {show ? "Masquer" : "Afficher"}
          </Button>
          <Button variant="gold" onClick={submit} disabled={loading || !current || !next || !confirmPwd}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Mettre à jour
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">12 car. min, avec majuscule, minuscule, chiffre et caractère spécial.</p>
      </div>
    </Card>
  );
};

export default Admin;

