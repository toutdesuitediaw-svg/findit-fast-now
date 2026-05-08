import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, ShoppingCart, Shield, User, X } from "lucide-react";
import Logo from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useCart } from "@/hooks/useCart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Accueil", to: "/" },
  { label: "Annonces", to: "/annonces" },
  { label: "Annonces Premium", to: "/annonces?sort=premium" },
  { label: "Contact", to: "/#contact" },
];

const Header = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { count } = useCart();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/15 bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-4 py-3 md:py-4 px-4">
        <Logo />

        <nav className="hidden lg:flex items-center gap-7">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="text-sm font-medium transition-colors hover:text-primary text-foreground/85"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outlineGold">
                  <User className="w-4 h-4" />
                  Mon compte
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Tableau de bord
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profil")}>
                  <User className="w-4 h-4 mr-2" /> Mon profil
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="w-4 h-4 mr-2" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outlineGold" onClick={() => navigate("/auth")}>
              <User className="w-4 h-4" />
              Se connecter
            </Button>
          )}
          <Button variant="gold" onClick={() => navigate("/panier")} className="relative">
            Panier
            <ShoppingCart className="w-4 h-4" />
            {count > 0 && (
              <span
                key={count}
                aria-label={`${count} article(s) dans le panier`}
                className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center animate-in zoom-in"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
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
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="text-sm font-medium py-2 text-foreground/85"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              {user ? (
                <>
                  <Button variant="outlineGold" onClick={() => { navigate("/dashboard"); setOpen(false); }}>Tableau de bord</Button>
                  <Button variant="gold" onClick={() => { navigate("/publier"); setOpen(false); }}>Publier une annonce</Button>
                  <Button variant="ghost" onClick={handleSignOut}>Déconnexion</Button>
                </>
              ) : (
                <>
                  <Button variant="outlineGold" onClick={() => { navigate("/auth"); setOpen(false); }}>Se connecter</Button>
                  <Button variant="gold" onClick={() => { navigate("/auth"); setOpen(false); }}>Publier une annonce</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
