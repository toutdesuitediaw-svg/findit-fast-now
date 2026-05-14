import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

export function formatPublished(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const days = differenceInDays(new Date(), d);
  if (days === 0) return "Publié aujourd'hui";
  if (days < 30) return `Publié ${formatDistanceToNow(d, { locale: fr, addSuffix: true })}`;
  return `Publié le ${format(d, "d MMMM yyyy", { locale: fr })}`;
}

export function formatUpdated(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return `Mis à jour ${formatDistanceToNow(d, { locale: fr, addSuffix: true })}`;
}

export type ExpiryStatus = "fresh" | "soon" | "imminent" | "expired";

export function getExpiry(expiresAt: string | Date | null | undefined): {
  status: ExpiryStatus;
  daysLeft: number;
  label: string;
} {
  if (!expiresAt) return { status: "fresh", daysLeft: 365, label: "" };
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const days = differenceInDays(d, new Date());
  if (days < 0) return { status: "expired", daysLeft: 0, label: "Annonce expirée" };
  if (days <= 7) return { status: "imminent", daysLeft: days, label: `Expire dans ${days}j` };
  if (days <= 30) return { status: "soon", daysLeft: days, label: `Expire dans ${days}j` };
  return { status: "fresh", daysLeft: days, label: `Expire le ${format(d, "d MMM yyyy", { locale: fr })}` };
}

export function isNew(publishedAt: string | Date | null | undefined): boolean {
  if (!publishedAt) return false;
  const d = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
  return differenceInDays(new Date(), d) <= 7;
}
