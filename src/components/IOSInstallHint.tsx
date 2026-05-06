import { useEffect, useState } from "react";
import { Share, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "ios-install-hint-dismissed";

const IOSInstallHint = () => {
  const [show, setShow] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(80);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|chrome|android/.test(ua);
    // @ts-ignore
    const isStandalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem(DISMISS_KEY);

    if (isIOS && isSafari && !isStandalone && !dismissed) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Distance from bottom of layout viewport to bottom of visual viewport
      const keyboardInset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      // Keep a 16px breathing room above the keyboard, default 80px otherwise
      setBottomOffset(keyboardInset > 0 ? keyboardInset + 16 : 80);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [show]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{ bottom: `${bottomOffset}px` }}
      className="fixed left-3 right-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 transition-[bottom] duration-200"
    >
      <button
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
        <div className="flex-1 pr-4">
          <p className="text-sm font-semibold text-foreground">Installer Tout de Suite</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajoutez l'app à votre écran d'accueil pour un accès rapide.
          </p>
          <ol className="mt-2 space-y-1 text-xs text-foreground">
            <li className="flex items-center gap-1.5">
              <span className="font-semibold">1.</span> Touchez
              <Share className="inline h-4 w-4 text-primary" />
              <span>en bas de Safari</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-semibold">2.</span> Choisissez
              <Plus className="inline h-4 w-4 text-primary" />
              <span className="font-medium">« Sur l'écran d'accueil »</span>
            </li>
          </ol>
          <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" onClick={dismiss}>
            J'ai compris
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IOSInstallHint;
