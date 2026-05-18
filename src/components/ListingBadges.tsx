import { BadgeCheck, Crown, Flame, Briefcase } from "lucide-react";

export interface ListingBadgesData {
  is_premium?: boolean | null;
  is_urgent?: boolean | null;
  seller_verified?: boolean | null;
  seller_pro?: boolean | null;
}

const base =
  "inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-1 rounded uppercase shadow-sm";

const ListingBadges = ({ listing, size = "sm" }: { listing: ListingBadgesData; size?: "sm" | "md" }) => {
  const px = size === "md" ? "px-2.5 py-1.5 text-xs" : "";
  return (
    <div className="flex flex-wrap gap-1.5">
      {listing.is_premium && (
        <span className={`${base} ${px} bg-gradient-gold text-primary-foreground`}>
          <Crown className="w-3 h-3" /> Premium
        </span>
      )}
      {listing.is_urgent && (
        <span className={`${base} ${px} bg-red-600 text-white animate-pulse`}>
          <Flame className="w-3 h-3" /> Urgent
        </span>
      )}
      {listing.seller_pro && (
        <span className={`${base} ${px} bg-blue-600 text-white`}>
          <Briefcase className="w-3 h-3" /> Pro
        </span>
      )}
      {listing.seller_verified && (
        <span className={`${base} ${px} bg-emerald-600 text-white`}>
          <BadgeCheck className="w-3 h-3" /> Vérifié
        </span>
      )}
    </div>
  );
};

export default ListingBadges;
