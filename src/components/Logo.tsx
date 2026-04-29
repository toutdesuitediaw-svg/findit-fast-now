import { Infinity } from "lucide-react";

const Logo = () => (
  <a href="/" className="flex items-center gap-2 group">
    <div className="flex items-center gap-1.5">
      <span className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
        TOUT
      </span>
      <Infinity
        className="w-7 h-7 md:w-8 md:h-8 text-primary drop-shadow-[0_0_8px_hsl(43_74%_56%/0.6)] transition-transform group-hover:scale-110"
        strokeWidth={2.5}
      />
      <span className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
        SUITE
      </span>
    </div>
    <span className="hidden sm:block text-[10px] tracking-[0.3em] text-primary/80 font-semibold ml-1 mt-1">
      ANNONCES
    </span>
  </a>
);

export default Logo;
