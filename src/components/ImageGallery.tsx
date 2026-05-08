import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ImageGalleryProps {
  images: string[];
  alt: string;
  badge?: React.ReactNode;
  topRight?: React.ReactNode;
}

const FALLBACK = "/placeholder.svg";
export const MAX_GALLERY_IMAGES = 8;

const resolveSrc = (src: string): string => {
  if (!src) return FALLBACK;
  if (/^(https?:|data:|blob:)/i.test(src) || src.startsWith("/")) return src;
  const { data } = supabase.storage.from("listing-photos").getPublicUrl(src);
  return data.publicUrl || FALLBACK;
};

const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src.endsWith(FALLBACK)) return;
  img.src = FALLBACK;
  img.classList.add("opacity-60");
};

const ImageGallery = ({ images, alt, badge, topRight }: ImageGalleryProps) => {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const touchStartX = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const cleaned = useMemo(() => (images ?? []).filter(Boolean), [images]);
  const overflow = Math.max(0, cleaned.length - MAX_GALLERY_IMAGES);
  const resolved = useMemo(
    () => cleaned.slice(0, MAX_GALLERY_IMAGES).map(resolveSrc),
    [cleaned],
  );
  const hasImages = resolved.length > 0;
  const total = resolved.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!total) return;
      setActive((i) => (i + dir + total) % total);
      setZoom(1);
    },
    [total],
  );

  // Keyboard nav in lightbox
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  // Scroll active thumb into view
  useEffect(() => {
    const el = thumbsRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const onMouseMoveZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom === 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <div className="select-none">
      {/* Main image */}
      <div
        className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-card border border-border"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {hasImages ? (
          <img
            src={resolved[active]}
            alt={`${alt} — photo ${active + 1}`}
            className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.02]"
            onClick={() => {
              setZoom(1);
              setOpen(true);
            }}
            onError={handleImgError}
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="w-8 h-8" />
            <span className="text-sm">Pas de photo</span>
          </div>
        )}

        {badge && <div className="absolute top-4 left-4 z-10">{badge}</div>}
        {topRight && <div className="absolute top-4 right-4 z-10">{topRight}</div>}

        {hasImages && (
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOpen(true);
            }}
            aria-label="Agrandir"
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Photo précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Photo suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur border border-border rounded-full px-3 py-1 text-xs font-medium">
              {active + 1} / {total}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div
          ref={thumbsRef}
          className="mt-3 flex gap-2 overflow-x-auto scroll-smooth pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {resolved.map((src, i) => (
            <button
              key={i}
              data-idx={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Voir photo ${i + 1}`}
              className={cn(
                "flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 transition-all",
                active === i
                  ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                  : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" onError={handleImgError} />
            </button>
          ))}
        </div>
      )}

      {overflow > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Affichage limité aux {MAX_GALLERY_IMAGES} premières photos ({overflow} de plus non affichée{overflow > 1 ? "s" : ""}).
        </p>
      )}

      {/* Lightbox */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[100vw] w-screen h-screen sm:rounded-none border-0 p-0 bg-background/98 backdrop-blur-xl flex flex-col gap-0">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <span className="text-sm font-medium tracking-wide">
              {hasImages ? `${active + 1} / ${total}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
                aria-label="Dézoomer"
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs w-10 text-center text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))}
                aria-label="Zoomer"
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 relative overflow-hidden flex items-center justify-center"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onMouseMove={onMouseMoveZoom}
            onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
          >
            {hasImages && (
              <img
                src={resolved[active]}
                alt={`${alt} — photo ${active + 1}`}
                draggable={false}
                onError={handleImgError}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                }}
                className={cn(
                  "max-w-full max-h-full object-contain transition-transform duration-200",
                  zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
                )}
              />
            )}

            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Photo précédente"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Photo suivante"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {total > 1 && (
            <div className="border-t border-border/50 p-3 flex gap-2 overflow-x-auto justify-center">
              {resolved.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActive(i);
                    setZoom(1);
                  }}
                  className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all",
                    active === i
                      ? "border-primary"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" onError={handleImgError} />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageGallery;
