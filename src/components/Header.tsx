import { useState } from "react";
import { ChevronDown, Menu, Plus, User, X } from "lucide-react";
import Logo from "./Logo";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Accueil", href: "#", active: true },
  { label: "Catégories", href: "#categories", hasDropdown: true },
  { label: "Publier une annonce", href: "#publier" },
  { label: "Annonces Premium", href: "#premium" },
  { label: "Blog", href: "#blog" },
  { label: "Contact", href: "#contact" },
];

const Header = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-4 py-4">
        <Logo />

        <nav className="hidden lg:flex items-center gap-7">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`relative text-sm font-medium transition-colors hover:text-primary flex items-center gap-1 ${
                item.active ? "text-primary" : "text-foreground/85"
              }`}
            >
              {item.label}
              {item.hasDropdown && <ChevronDown className="w-3.5 h-3.5" />}
              {item.active && (
                <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-gradient-gold rounded-full" />
              )}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="outlineGold" size="default">
            <User className="w-4 h-4" />
            Se connecter
          </Button>
          <Button variant="gold" size="default">
            Publier une annonce
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <button
          aria-label="Menu"
          onClick={() => setOpen(!open)}
          className="lg:hidden text-foreground p-2"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="container mx-auto py-4 flex flex-col gap-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`text-sm font-medium py-2 ${
                  item.active ? "text-primary" : "text-foreground/85"
                }`}
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outlineGold">Se connecter</Button>
              <Button variant="gold">Publier une annonce</Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
