import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Msg {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  key: string;
  listing_id: string;
  other_id: string;
  listing_title: string;
  other_name: string;
  last: Msg;
  unread: number;
}

const MessagesTab = ({ userId }: { userId: string }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [listings, setListings] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const msgs = (data ?? []) as Msg[];
    setMessages(msgs);

    const listingIds = Array.from(new Set(msgs.map((m) => m.listing_id)));
    const userIds = Array.from(new Set(msgs.flatMap((m) => [m.sender_id, m.recipient_id]).filter((id) => id !== userId)));

    const [{ data: ls }, { data: ps }] = await Promise.all([
      listingIds.length ? supabase.from("listings").select("id,title").in("id", listingIds) : Promise.resolve({ data: [] as any }),
      userIds.length ? supabase.from("profiles").select("id,display_name").in("id", userIds) : Promise.resolve({ data: [] as any }),
    ]);
    setListings(Object.fromEntries((ls ?? []).map((l: any) => [l.id, l.title])));
    setProfiles(Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? "Utilisateur"])));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("messages-dash")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const conversations: Conversation[] = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const m of messages) {
      const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
      const key = `${m.listing_id}:${other}`;
      const prev = map.get(key);
      const unreadInc = m.recipient_id === userId && !m.read_at ? 1 : 0;
      if (!prev || new Date(m.created_at) > new Date(prev.last.created_at)) {
        map.set(key, {
          key,
          listing_id: m.listing_id,
          other_id: other,
          listing_title: listings[m.listing_id] ?? "Annonce",
          other_name: profiles[other] ?? "Utilisateur",
          last: m,
          unread: (prev?.unread ?? 0) + unreadInc,
        });
      } else {
        prev.unread += unreadInc;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
    );
  }, [messages, listings, profiles, userId]);

  const activeConv = conversations.find((c) => c.key === openKey) ?? null;
  const thread = useMemo(() => {
    if (!activeConv) return [];
    return messages.filter(
      (m) =>
        m.listing_id === activeConv.listing_id &&
        ((m.sender_id === userId && m.recipient_id === activeConv.other_id) ||
          (m.sender_id === activeConv.other_id && m.recipient_id === userId)),
    );
  }, [messages, activeConv, userId]);

  useEffect(() => {
    if (!activeConv) return;
    // mark unread as read
    const ids = thread.filter((m) => m.recipient_id === userId && !m.read_at).map((m) => m.id);
    if (ids.length) {
      supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids).then();
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  }, [activeConv, thread, userId]);

  const send = async () => {
    if (!activeConv || !reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      listing_id: activeConv.listing_id,
      sender_id: userId,
      recipient_id: activeConv.other_id,
      content: reply.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setReply("");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-2xl">
        <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Aucune conversation pour le moment</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {conversations.map((c) => (
          <button
            key={c.key}
            onClick={() => setOpenKey(c.key)}
            className="w-full text-left rounded-xl bg-card border border-border p-4 hover:border-primary/50 transition flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-semibold text-primary shrink-0">
              {c.other_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-between">
                <p className="font-semibold truncate">{c.other_name}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(c.last.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">À propos de : {c.listing_title}</p>
              <p className="text-sm truncate mt-0.5">
                {c.last.sender_id === userId ? "Vous : " : ""}
                {c.last.content}
              </p>
            </div>
            {c.unread > 0 && <Badge className="bg-primary text-primary-foreground">{c.unread}</Badge>}
          </button>
        ))}
      </div>

      <Dialog open={!!openKey} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent className="max-w-lg flex flex-col h-[80vh] p-0">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle className="text-base">
              {activeConv?.other_name}
              <span className="block text-xs font-normal text-muted-foreground">
                {activeConv?.listing_title}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {thread.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Écrire un message…"
              className="min-h-[44px] max-h-32 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button variant="gold" onClick={send} disabled={sending || !reply.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessagesTab;
