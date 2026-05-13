import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ReportListingDialog = ({ listingId, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) {
      toast.info("Connectez-vous pour signaler");
      navigate("/auth");
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) return;
    if (trimmed.length > 200) { toast.error("Motif trop long (200 max)"); return; }
    if (details.length > 1000) { toast.error("Détails trop longs (1000 max)"); return; }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-report", {
      body: {
        target_type: "listing",
        target_id: listingId,
        reason: trimmed,
        details: details.trim() || null,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Erreur lors du signalement");
      return;
    }
    toast.success("Signalement envoyé. Merci !");
    onOpenChange(false);
    setReason("");
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Signaler cette annonce</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Motif</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Ex: Arnaque, contenu interdit, faux produit..."
            />
          </div>
          <div>
            <Label>Détails (facultatif)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              placeholder="Décrivez le problème"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportListingDialog;
