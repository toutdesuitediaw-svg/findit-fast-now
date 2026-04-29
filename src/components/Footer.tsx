import Logo from "./Logo";

const Footer = () => {
  const cols = [
    {
      title: "Catégories",
      links: ["Immobilier", "Véhicules", "Électronique", "Emploi", "Mode & Beauté"],
    },
    {
      title: "À propos",
      links: ["Qui sommes-nous", "Blog", "Carrières", "Presse"],
    },
    {
      title: "Aide",
      links: ["Centre d'aide", "Conditions", "Confidentialité", "Contact"],
    },
  ];

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              La plateforme numéro 1 pour tous vos annonces simples, rapides et efficaces.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-semibold text-foreground mb-4">{c.title}</h4>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TOUT DE SUITE Annonces. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
