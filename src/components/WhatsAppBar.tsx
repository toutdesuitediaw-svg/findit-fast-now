import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WhatsAppBar = () => {
  return (
    <section className="bg-gradient-gold">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-background/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="text-primary-foreground">
            <div className="font-bold">Besoin d'aide ? Contactez-nous sur WhatsApp</div>
            <div className="text-sm opacity-80">Réponse rapide garantie !</div>
          </div>
        </div>
        <Button className="bg-background text-foreground hover:bg-background/90 font-semibold">
          <MessageCircle className="w-4 h-4" />
          Nous contacter
        </Button>
      </div>
    </section>
  );
};

export default WhatsAppBar;
