import { useEffect, useState } from "react";
import { Smartphone, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  pushSupported, pushBlocked, isSubscribed, subscribePush, unsubscribePush, getPushPermissionState,
} from "@/lib/webPush";

export const PushSubscriptionToggle = () => {
  const [supported, setSupported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    setBlocked(pushBlocked());
    (async () => {
      setPermission(await getPushPermissionState());
      setSubscribed(await isSubscribed());
    })();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const r = await subscribePush();
    setLoading(false);
    if (r.ok) {
      setSubscribed(true);
      setPermission("granted");
      toast.success("Notifications push activées 🔔");
    } else {
      toast.error(r.reason ?? "Activation impossible");
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    await unsubscribePush();
    setLoading(false);
    setSubscribed(false);
    toast.success("Notifications push désactivées");
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold">Notifications mobiles & navigateur</div>
          <p className="text-sm text-muted-foreground">
            Recevez les annonces premium même quand l'app est fermée (Android, Chrome, Edge, Firefox, iOS 16.4+ après installation).
          </p>
        </div>
      </div>

      {!supported ? (
        <p className="text-xs text-muted-foreground">Votre navigateur ne supporte pas les notifications push.</p>
      ) : blocked ? (
        <p className="text-xs text-muted-foreground">
          Indisponible dans l'aperçu Lovable. Testez sur <span className="font-medium">toutsuitannonce.com</span>.
        </p>
      ) : permission === "denied" ? (
        <p className="text-xs text-destructive">
          Vous avez bloqué les notifications. Réautorisez-les dans les paramètres du navigateur (🔒 dans la barre d'adresse).
        </p>
      ) : subscribed ? (
        <Button variant="outline" onClick={handleDisable} disabled={loading} size="sm">
          <BellOff className="mr-2 h-4 w-4" /> Désactiver
        </Button>
      ) : (
        <Button variant="gold" onClick={handleEnable} disabled={loading} size="sm">
          <BellRing className="mr-2 h-4 w-4" /> {loading ? "…" : "Activer les notifications push"}
        </Button>
      )}
    </div>
  );
};

export default PushSubscriptionToggle;
