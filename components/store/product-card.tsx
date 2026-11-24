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

  return (
    <article className="group relative flex h-full flex-col">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-line bg-surface-3",
          "transition-[border-color,box-shadow] duration-300 group-hover:border-line-2 group-hover:shadow-lg",
          compact ? "aspect-[16/9]" : "aspect-[16/10]",
        )}
      >
        <ProductCover product={product} variant="plain" className={cn(!product.available && "opacity-55 grayscale")} />
        {product.video && <HoverVideo src={product.video} poster={poster} />}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-[color-mix(in_oklab,var(--ground)_70%,transparent)] px-2.5 py-1 text-[11.5px] text-ink-2 backdrop-blur-md">
            {product.categoryLabel}
          </span>
          {!product.available ? (
            <Badge tone="warning">{d.badges.soon}</Badge>
          ) : (
            badge && <Badge tone="accent">{d.badges[BADGE_LABELS[badge]]}</Badge>
          )}
        </div>

        <WishlistButton
          id={product.id}
          labels={{ add: d.store.wishlist, added: d.store.inWishlist }}
          className="absolute right-3 bottom-3 z-10"
        />
      </div>

      <div className={cn("flex flex-1 flex-col pt-3.5", compact ? "gap-1.5" : "gap-2")}>
        <div className="flex items-baseline justify-between gap-4">
          <h3 className={cn("min-w-0 font-display leading-[1.12] tracking-[-0.02em]", compact ? "text-[15.5px]" : "text-[17.5px]")}>
            <Link href={href} className="outline-offset-4 after:absolute after:inset-0 after:content-['']">
              {product.title}
            </Link>
          </h3>
          {product.available && (
            <span className="shrink-0 font-mono text-[15px] font-medium text-ink tabular-nums">
              {formatPrice(product.priceEur, locale)}
            </span>
          )}
        </div>

        {!compact && <p className="line-clamp-2 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-3">{product.summary}</p>}

        <div className="mt-auto flex items-center gap-3 pt-1 text-[12px] text-muted">
          {product.rating !== null && product.reviewCount > 0 && <Rating value={product.rating} count={product.reviewCount} />}
          {product.fileTypes.length > 0 && <span className="font-mono text-[11px] tracking-wide">{product.fileTypes.join(" ")}</span>}
          {product.setupTime && !compact && <span className="truncate">{product.setupTime}</span>}
        </div>
      </div>
    </article>
  );
}
