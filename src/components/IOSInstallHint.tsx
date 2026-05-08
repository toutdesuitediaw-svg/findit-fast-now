import { useEffect, useState } from "react";
import { Share, X, Plus, MoreVertical, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "install-hint-dismissed";
const DEFAULT_BOTTOM = 80;

type Platform = "ios" | "android" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOSInstallHint = () => {
  const [platform, setPlatform] = useState<Platform>(null);
  const [show, setShow] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(DEFAULT_BOTTOM);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|chrome|android/.test(ua);
    const isAndroid = /android/.test(ua);
    // @ts-ignore
    const isStandalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem(DISMISS_KEY);

    if (isStandalone || dismissed) return;

    let detected: Platform = null;
    if (isIOS && isSafari) detected = "ios";
    else if (isAndroid) detected = "android";

    // Capture the Android/Chrome native install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Fallback: still show iOS hint (no beforeinstallprompt on iOS)
    let t: ReturnType<typeof setTimeout> | undefined;
    if (detected) {
      t = setTimeout(() => {
        setPlatform((p) => p ?? detected);
        setShow(true);
      }, 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (t) clearTimeout(t);
    };
  }, []);

  // Keyboard handling for both iOS and Android.
  useEffect(() => {
    if (!show) return;

    const baseHeight = window.innerHeight;

    const computeOffset = () => {
      const vv = window.visualViewport;
      let keyboardInset = 0;
      if (vv) {
        keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      } else {
        // Fallback for older Android WebViews: window.innerHeight shrinks when keyboard opens.
        keyboardInset = Math.max(0, baseHeight - window.innerHeight);
      }
      setBottomOffset(keyboardInset > 0 ? keyboardInset + 16 : DEFAULT_BOTTOM);
    };

    computeOffset();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", computeOffset);
      vv.addEventListener("scroll", computeOffset);
    }
    window.addEventListener("resize", computeOffset);

    // Re-evaluate when an input gains/loses focus (Android quirk).
    const onFocusIn = () => setTimeout(computeOffset, 250);
    const onFocusOut = () => setTimeout(computeOffset, 250);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", computeOffset);
        vv.removeEventListener("scroll", computeOffset);
      }
      window.removeEventListener("resize", computeOffset);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, [show]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show || !platform) return null;

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
          {platform === "ios" ? (
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
          ) : deferredPrompt ? (
            <div className="mt-3">
              <Button
                size="sm"
                variant="gold"
                className="h-9 px-3 text-xs"
                onClick={async () => {
                  await deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (outcome === "accepted") localStorage.setItem(DISMISS_KEY, "1");
                  setDeferredPrompt(null);
                  setShow(false);
                }}
              >
                <Download className="h-4 w-4 mr-1.5" /> Installer l'application
              </Button>
            </div>
          ) : (
            <ol className="mt-2 space-y-1 text-xs text-foreground">
              <li className="flex items-center gap-1.5">
                <span className="font-semibold">1.</span> Touchez
                <MoreVertical className="inline h-4 w-4 text-primary" />
                <span>en haut à droite</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="font-semibold">2.</span>
                <span className="font-medium">« Ajouter à l'écran d'accueil »</span>
              </li>
            </ol>
          )}
          <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" onClick={dismiss}>
            J'ai compris
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IOSInstallHint;
