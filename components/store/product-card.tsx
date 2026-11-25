import Link from "next/link";
import { Badge } from "@/components/primitives/badge";
import { Rating } from "@/components/primitives/display";
import { HoverVideo } from "@/components/store/hover-video";
import { ProductCover } from "@/components/store/product-cover";
import { WishlistButton } from "@/components/store/wishlist";
import type { Product } from "@/lib/api/store";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BADGE_LABELS: Record<string, keyof Dictionary["badges"]> = {
  trending: "trend2026",
  new: "new",
  bestseller: "hit",
};

/**
 * A shelf item: the picture is the card, the words sit under it without a box
 * around them. Products with a preview clip play it while pointed at.
 *
 * A product not on sale yet is still on the shelf — people see what is coming
 * — but it is not a link: it wears a "in the workshop" label instead of a price.
 */
export function ProductCard({
  product,
  locale,
  d,
  compact,
}: {
  product: Product;
  locale: Locale;
  d: Dictionary;
  compact?: boolean;
}) {
  const href = path(`/store/${product.slug}`, locale);
  const badge = product.badges.find((value) => BADGE_LABELS[value]);
  const poster = product.video ? product.video.replace(/\.mp4$/, ".jpg") : undefined;
  const live = product.available;
  const building = locale === "en" ? "In the workshop" : locale === "ukr" ? "У розробці" : "В разработке";

  return (
    <article className={cn("group relative flex h-full flex-col", !live && "cursor-default")}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-line bg-surface-3",
          live && "transition-[border-color,box-shadow] duration-300 group-hover:border-line-2 group-hover:shadow-lg",
          compact ? "aspect-[16/9]" : "aspect-[16/10]",
        )}
      >
        <ProductCover product={product} variant="plain" className={cn(!live && "opacity-40 grayscale")} />
        {live && product.video && <HoverVideo src={product.video} poster={poster} />}

        {/* Not on sale yet: hazard tape across the corner, like a shop being fitted out. */}
        {!live && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute top-1/2 -right-1/4 -left-1/4 h-7 -translate-y-1/2 -rotate-6 opacity-80"
              style={{
                background:
                  "repeating-linear-gradient(-45deg, var(--accent) 0 14px, color-mix(in oklab, var(--ground) 85%, transparent) 14px 28px)",
              }}
            />
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-[color-mix(in_oklab,var(--ground)_70%,transparent)] px-2.5 py-1 text-[11.5px] text-ink-2 backdrop-blur-md">
            {product.categoryLabel}
          </span>
          {live && product.listPriceEur !== null ? (
            <Badge tone="accent">{locale === "en" ? "Opening price" : "Цена открытия"}</Badge>
          ) : (
            live && badge && <Badge tone="accent">{d.badges[BADGE_LABELS[badge]]}</Badge>
          )}
        </div>

        {live && (
          <WishlistButton
            id={product.id}
            labels={{ add: d.store.wishlist, added: d.store.inWishlist }}
            className="absolute right-3 bottom-3 z-10"
          />
        )}
      </div>

      <div className={cn("flex flex-1 flex-col pt-3.5", compact ? "gap-1.5" : "gap-2")}>
        <div className="flex items-baseline justify-between gap-4">
          <h3
            className={cn(
              "min-w-0 font-display leading-[1.12] tracking-[-0.02em]",
              compact ? "text-[15.5px]" : "text-[17.5px]",
              !live && "text-ink-3",
            )}
          >
            {live ? (
              <Link href={href} className="outline-offset-4 after:absolute after:inset-0 after:content-['']">
                {product.title}
              </Link>
            ) : (
              product.title
            )}
          </h3>
          {live ? (
            <span className="flex shrink-0 items-baseline gap-1.5">
              {product.listPriceEur !== null && (
                <span className="font-mono text-[12.5px] text-faint line-through tabular-nums">
                  {formatPrice(product.listPriceEur, locale)}
                </span>
              )}
              <span
                className={cn(
                  "font-mono text-[15px] font-medium tabular-nums",
                  product.listPriceEur !== null ? "text-accent-ink" : "text-ink",
                )}
              >
                {formatPrice(product.priceEur, locale)}
              </span>
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
              {building}
            </span>
          )}
        </div>

        {!compact && (
          <p className={cn("line-clamp-2 max-w-[52ch] text-[13.5px] leading-relaxed", live ? "text-ink-3" : "text-faint")}>
            {product.summary}
          </p>
        )}

        {live && (
          <div className="mt-auto flex items-center gap-3 pt-1 text-[12px] text-muted">
            {product.rating !== null && product.reviewCount > 0 && <Rating value={product.rating} count={product.reviewCount} />}
            {product.fileTypes.length > 0 && <span className="font-mono text-[11px] tracking-wide">{product.fileTypes.join(" ")}</span>}
            {product.setupTime && !compact && <span className="truncate">{product.setupTime}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
