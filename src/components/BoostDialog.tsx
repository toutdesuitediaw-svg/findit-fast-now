import { useState } from "react";
import { Crown, Flame, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

interface BoostPlan {
  id: string;
  type: "premium" | "urgent";
  label: string;
  duration: number;
  price: number;
  icon: typeof Crown;
  highlight: string;
}

export const BOOST_PLANS: BoostPlan[] = [
  { id: "premium-7", type: "premium", label: "Premium 7 jours", duration: 7, price: 2000, icon: Crown, highlight: "En tête de liste" },
  { id: "premium-30", type: "premium", label: "Premium 30 jours", duration: 30, price: 5000, icon: Crown, highlight: "Visibilité maximale 1 mois" },
  { id: "urgent-3", type: "urgent", label: "Urgent 3 jours", duration: 3, price: 1000, icon: Flame, highlight: "Badge rouge clignotant" },
  { id: "urgent-7", type: "urgent", label: "Urgent 7 jours", duration: 7, price: 2000, icon: Flame, highlight: "Vendre plus vite" },
];

const BoostDialog = ({
  open,
  onOpenChange,
  listingId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listingId: string | null;
}) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const submit = async (plan: BoostPlan) => {
    if (!user || !listingId) return;
    trackEvent("boost_click", { plan_id: plan.id, boost_type: plan.type, value: plan.price });
    setSubmitting(plan.id);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      listing_id: listingId,
      type: "listing_boost",
      status: "pending",
      amount: plan.price,
      currency: "FCFA",
      metadata: { boost_type: plan.type, duration_days: plan.duration, plan_id: plan.id },
    });
    setSubmitting(null);
    if (!error) {
      trackEvent("transaction_created", {
        transaction_type: "listing_boost",
        plan_id: plan.id,
        value: plan.price,
        currency: "FCFA",
      });
    }
    if (error) {
      toast.error("Impossible de créer la demande de boost");
      return;
    }
    toast.success("Demande de boost enregistrée. Activation après paiement.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Booster votre annonce</DialogTitle>
          <DialogDescription>
            Choisissez une formule. Le badge s'active automatiquement après confirmation du paiement.
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          {BOOST_PLANS.map((p) => {
            const Icon = p.icon;
            const isPremium = p.type === "premium";
            return (
              <button
                key={p.id}
                onClick={() => submit(p)}
                disabled={submitting !== null}
                className={`text-left rounded-xl border-2 p-4 transition hover:scale-[1.02] disabled:opacity-50 ${
                  isPremium ? "border-primary/40 bg-primary/5" : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${isPremium ? "text-primary" : "text-red-500"}`} />
                  <span className="font-bold">{p.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{p.highlight}</p>
                <p className="text-2xl font-bold">
                  {p.price.toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">FCFA</span>
                </p>
                {submitting === p.id && <Loader2 className="w-4 h-4 animate-spin mt-2" />}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground pt-2">
          Le paiement est validé par notre équipe. Une fois confirmé, votre badge est appliqué pour la durée choisie.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default BoostDialog;
