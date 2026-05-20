import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Discrete notification sound (data URL of a short chime)
const playChime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore
  }
};

const NotificationsBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const mounted = useRef(false);

  const unread = items.filter((n) => !n.is_read).length;
  const hasPremium = items.some((n) => !n.is_read && n.type === "new_premium_listing");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setItems(data as Notification[]);
  };

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    load();
    supabase
      .from("notification_preferences")
      .select("sound_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSoundOn(data?.sound_enabled ?? true));

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 20));
          if (mounted.current && soundOn) playChime();
          const isPremium = n.type === "new_premium_listing";
          toast(n.title, {
            description: n.body ?? undefined,
            className: isPremium ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]" : undefined,
            action: n.link
              ? { label: "Voir", onClick: () => navigate(n.link!) }
              : undefined,
          });
        }
      )
      .subscribe();
    mounted.current = true;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, soundOn]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const onItemClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${hasPremium ? "animate-pulse" : ""}`}
          aria-label="Notifications"
        >
          <Bell className={`w-5 h-5 ${hasPremium ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]" : ""}`} />
          {unread > 0 && (
            <span
              className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                hasPremium
                  ? "bg-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Notifications</span>
          <button
            onClick={() => { setOpen(false); navigate("/notifications"); }}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            aria-label="Préférences"
          >
            <Settings className="w-3.5 h-3.5" /> Préférences
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune notification</div>
          ) : (
            items.map((n) => {
              const isPremium = n.type === "new_premium_listing";
              return (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted transition-colors ${
                    !n.is_read ? "bg-primary/5" : ""
                  } ${isPremium ? "border-l-2 border-l-primary" : ""}`}
                >
                  <div className="text-sm font-medium flex items-center gap-1">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("fr-FR")}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t">
          <button
            onClick={() => { setOpen(false); navigate("/notifications"); }}
            className="w-full text-center text-xs py-2.5 text-primary hover:bg-muted transition-colors"
          >
            Voir tout
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
