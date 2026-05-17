import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, LogIn, UserPlus, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type PromptOptions = { title?: string; message?: string };
type Ctx = { requireAuth: (opts?: PromptOptions) => boolean };

const AuthPromptCtx = createContext<Ctx | null>(null);

export const useAuthPrompt = () => {
  const ctx = useContext(AuthPromptCtx);
  if (!ctx) throw new Error("useAuthPrompt must be used within AuthPromptProvider");
  return ctx;
};

export const AuthPromptProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PromptOptions>({});

  const requireAuth = useCallback(
    (o?: PromptOptions) => {
      if (user) return true;
      setOpts(o ?? {});
      setOpen(true);
      return false;
    },
    [user],
  );

  const go = (path: string) => {
    setOpen(false);
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`${path}?redirect=${redirect}`);
  };

  return (
    <AuthPromptCtx.Provider value={{ requireAuth }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              {opts.title ?? "Connexion requise"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {opts.message ?? "Connectez-vous pour accéder à cette fonctionnalité."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>Créez un compte gratuit pour publier, contacter les vendeurs et sauvegarder vos favoris.</span>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => go("/auth")}>
              <LogIn className="w-4 h-4" /> Connexion
            </Button>
            <Button variant="gold" className="w-full sm:flex-1" onClick={() => go("/auth")}>
              <UserPlus className="w-4 h-4" /> Créer un compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthPromptCtx.Provider>
  );
};
