import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, Crown } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useSEO } from "@/lib/seo";
import PushSubscriptionToggle from "@/components/PushSubscriptionToggle";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface Prefs {
  enabled: boolean;
  premium_only: boolean;
  categories: string[];
  city: string | null;
  sound_enabled: boolean;
}

interface Category {
  id: string;
  name: string;
}

const NotificationsCenter = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useSEO({
    title: "Notifications | TOUT SUITE ANNONCES",
    description: "Centre de notifications et préférences d'alertes.",
  });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [notifsRes, prefsRes, catsRes] = await Promise.all([
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("categories").select("id, name").order("sort_order"),
      ]);
      if (notifsRes.data) setItems(notifsRes.data as Notification[]);
      if (catsRes.data) setCategories(catsRes.data as Category[]);
      if (prefsRes.data) {
        setPrefs(prefsRes.data as Prefs);
      } else {
        // Crée des préférences par défaut
        const { data } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id })
          .select()
          .single();
        if (data) setPrefs(data as Prefs);
      }
    })();
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("Toutes les notifications marquées comme lues");
  };

  const deleteAll = async () => {
    if (!user) return;
    if (!confirm("Supprimer toutes les notifications ?")) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setItems([]);
    toast.success("Notifications supprimées");
  };

  const removeOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const savePrefs = async () => {
    if (!user || !prefs) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error("Erreur lors de l'enregistrement");
    else toast.success("Préférences enregistrées");
  };

  const toggleCategory = (id: string) => {
    if (!prefs) return;
    const has = prefs.categories.includes(id);
    setPrefs({
      ...prefs,
      categories: has ? prefs.categories.filter((c) => c !== id) : [...prefs.categories, id],
    });
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-7 h-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
        </div>

        <Tabs defaultValue="inbox">
          <TabsList className="mb-6">
            <TabsTrigger value="inbox">Boîte de réception</TabsTrigger>
            <TabsTrigger value="settings">Préférences</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <Card className="p-4">
              <div className="flex justify-end gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={markAllRead} disabled={!items.some((n) => !n.is_read)}>
                  <Check className="w-4 h-4 mr-1" /> Tout marquer lu
                </Button>
                <Button variant="outline" size="sm" onClick={deleteAll} disabled={items.length === 0}>
                  <Trash2 className="w-4 h-4 mr-1" /> Vider
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Aucune notification pour l'instant</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((n) => {
                    const isPremium = n.type === "new_premium_listing";
                    return (
                      <div
                        key={n.id}
                        className={`group relative p-4 rounded-lg border transition-all hover:shadow-md ${
                          !n.is_read ? "bg-primary/5 border-primary/30" : "bg-background"
                        } ${isPremium ? "border-l-4 border-l-primary" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {isPremium && <Crown className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />}
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={async () => {
                              if (!n.is_read) {
                                await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                                setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                              }
                              if (n.link) navigate(n.link);
                            }}
                          >
                            <div className="font-semibold text-sm">{n.title}</div>
                            {n.body && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.body}</div>}
                            <div className="text-xs text-muted-foreground mt-2">
                              {new Date(n.created_at).toLocaleString("fr-FR")}
                            </div>
                          </div>
                          <button
                            onClick={() => removeOne(n.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6 space-y-6">
              {!prefs ? (
                <div className="text-center py-6 text-muted-foreground">Chargement…</div>
              ) : (
                <>
                  <PushSubscriptionToggle />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Activer les notifications</Label>
                      <p className="text-sm text-muted-foreground">Recevoir les alertes en temps réel</p>
                    </div>
                    <Switch
                      checked={prefs.enabled}
                      onCheckedChange={(v) => setPrefs({ ...prefs, enabled: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Annonces premium uniquement</Label>
                      <p className="text-sm text-muted-foreground">Alertes pour les annonces premium 👑</p>
                    </div>
                    <Switch
                      checked={prefs.premium_only}
                      onCheckedChange={(v) => setPrefs({ ...prefs, premium_only: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Son de notification</Label>
                      <p className="text-sm text-muted-foreground">Émettre un son discret à chaque nouvelle alerte</p>
                    </div>
                    <Switch
                      checked={prefs.sound_enabled}
                      onCheckedChange={(v) => setPrefs({ ...prefs, sound_enabled: v })}
                    />
                  </div>

                  <div>
                    <Label className="text-base font-semibold">Ville (optionnel)</Label>
                    <p className="text-sm text-muted-foreground mb-2">Recevoir uniquement les annonces de cette ville</p>
                    <Input
                      placeholder="Ex: Dakar"
                      value={prefs.city ?? ""}
                      onChange={(e) => setPrefs({ ...prefs, city: e.target.value || null })}
                    />
                  </div>

                  <div>
                    <Label className="text-base font-semibold">Catégories</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Aucune sélection = toutes les catégories
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={prefs.categories.includes(c.id)}
                            onCheckedChange={() => toggleCategory(c.id)}
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button variant="gold" onClick={savePrefs} disabled={saving} className="w-full">
                    {saving ? "Enregistrement…" : "Enregistrer les préférences"}
                  </Button>
                </>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default NotificationsCenter;
