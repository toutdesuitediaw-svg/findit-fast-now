import { useEffect, useState } from "react";
import { Apple, Share, Plus, Smartphone, MoreVertical, Download, CheckCircle2, Chrome, Home, Zap, Wifi, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { trackPwaEvent } from "@/lib/pwaAnalytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
      {n}
    </span>
    <div className="pt-1 text-sm text-foreground/90 flex-1">{children}</div>
  </li>
);

const Installer = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Track page view once
    trackPwaEvent("page_view");

    // @ts-ignore
    const isStandalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) setInstalled(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      trackPwaEvent("app_installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    trackPwaEvent("install_click");
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      trackPwaEvent("install_accepted");
    } else {
      trackPwaEvent("install_dismissed");
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    document.title = "Installer l'application TOUT DE SUITE sur iPhone et Android";
  }, []);

  return (
    <div className="min-h-screen bg-background">

      <Header />

      <main className="container mx-auto px-4 py-10 md:py-16">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 mb-6 shadow-xl">
            <img src="/icon-192.png" alt="Logo Tout de Suite" className="w-14 h-14 rounded-xl" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            Installez <span className="text-primary">TOUT DE SUITE</span> sur votre téléphone
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Accédez à toutes les annonces en un clic, comme une vraie application — sans passer par l'App Store.
          </p>

          {installed ? (
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 font-medium">
              <CheckCircle2 className="w-5 h-5" /> L'application est déjà installée
            </div>
          ) : deferredPrompt ? (
            <Button size="lg" variant="gold" className="mt-8 h-12 px-6 text-base" onClick={triggerInstall}>
              <Download className="w-5 h-5 mr-2" /> Installer l'application maintenant
            </Button>
          ) : null}
        </section>

        {/* Benefits */}
        <section className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto mb-14">
          {[
            { icon: Zap, title: "Ouverture instantanée", text: "Lancement direct depuis l'écran d'accueil" },
            { icon: Wifi, title: "Fonctionne hors-ligne", text: "Consultez vos pages déjà visitées sans connexion" },
            { icon: Bell, title: "Plein écran", text: "Aucune barre de navigateur, comme une vraie app" },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-5 border-border/60">
              <Icon className="w-7 h-7 text-primary mb-3" />
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{text}</p>
            </Card>
          ))}
        </section>

        {/* Guides */}
        <section className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* iPhone */}
          <Card className="p-6 border-border/60">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center">
                <Apple className="w-7 h-7 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Sur iPhone / iPad</h2>
                <p className="text-xs text-muted-foreground">Avec le navigateur Safari</p>
              </div>
            </div>

            <ol className="space-y-4">
              <Step n={1}>
                Ouvrez <span className="font-semibold">www.toutsuitannonce.com</span> dans <span className="font-semibold">Safari</span>.
              </Step>
              <Step n={2}>
                Touchez l'icône <Share className="inline w-4 h-4 text-primary mx-1" /> <span className="font-semibold">Partager</span> en bas de l'écran.
              </Step>
              <Step n={3}>
                Faites défiler et choisissez <Plus className="inline w-4 h-4 text-primary mx-1" /> <span className="font-semibold">« Sur l'écran d'accueil »</span>.
              </Step>
              <Step n={4}>
                Touchez <span className="font-semibold">« Ajouter »</span> en haut à droite. L'icône apparaît sur votre écran d'accueil.
              </Step>
            </ol>

            <div className="mt-5 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
              ⚠️ L'installation ne fonctionne <strong>qu'avec Safari</strong> sur iPhone, pas avec Chrome.
            </div>
          </Card>

          {/* Android */}
          <Card className="p-6 border-border/60">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Sur Android</h2>
                <p className="text-xs text-muted-foreground">Avec Chrome, Edge, Brave ou Opera</p>
              </div>
            </div>

            {deferredPrompt ? (
              <div className="mb-5 p-4 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm font-semibold text-foreground mb-2">Installation en un clic disponible !</p>
                <Button variant="gold" className="w-full" onClick={triggerInstall}>
                  <Download className="w-4 h-4 mr-2" /> Installer maintenant
                </Button>
              </div>
            ) : null}

            <ol className="space-y-4">
              <Step n={1}>
                Ouvrez <span className="font-semibold">www.toutsuitannonce.com</span> dans <Chrome className="inline w-4 h-4 text-primary mx-1" /> <span className="font-semibold">Chrome</span>.
              </Step>
              <Step n={2}>
                Touchez le menu <MoreVertical className="inline w-4 h-4 text-primary mx-1" /> en haut à droite.
              </Step>
              <Step n={3}>
                Choisissez <Home className="inline w-4 h-4 text-primary mx-1" /> <span className="font-semibold">« Installer l'application »</span> ou <span className="font-semibold">« Ajouter à l'écran d'accueil »</span>.
              </Step>
              <Step n={4}>
                Confirmez en touchant <span className="font-semibold">« Installer »</span>. L'app s'ajoute à votre écran d'accueil.
              </Step>
            </ol>
          </Card>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto mt-14">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              {
                q: "Est-ce que l'installation est gratuite ?",
                a: "Oui, 100% gratuite. Aucun téléchargement depuis l'App Store ou Google Play n'est nécessaire.",
              },
              {
                q: "L'app prend-elle de la place sur mon téléphone ?",
                a: "Très peu — quelques mégaoctets seulement, contre des centaines pour une app classique.",
              },
              {
                q: "Comment désinstaller l'application ?",
                a: "Appuyez longuement sur l'icône depuis votre écran d'accueil, puis choisissez « Supprimer » ou « Désinstaller ».",
              },
              {
                q: "Pourquoi le bouton « Installer » n'apparaît pas ?",
                a: "Sur iPhone, utilisez impérativement Safari. Sur Android, utilisez Chrome ou Edge. Si l'app est déjà installée, le bouton disparaît automatiquement.",
              },
            ].map(({ q, a }) => (
              <Card key={q} className="p-5 border-border/60">
                <h3 className="font-semibold text-foreground">{q}</h3>
                <p className="text-sm text-muted-foreground mt-2">{a}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Installer;
