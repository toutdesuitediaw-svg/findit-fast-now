import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WhatsAppBar = () => {
  return (
    <section className="border-y border-primary/20 bg-card/40">
      <div className="container mx-auto px-4 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-11 h-11 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm sm:text-base">Besoin d'aide ? Contactez-nous</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Support WhatsApp — réponse rapide garantie</div>
          </div>
        </div>
        <Button
          variant="gold"
          className="w-full sm:w-auto"
          asChild
        >
          <a
            href="https://wa.me/221784716055"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="w-4 h-4" />
            +221 78 471 60 55
          </a>
        </Button>
      </div>
    </section>
  );
};

export default WhatsAppBar;
