import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Rating } from "@/components/primitives/display";
import { WishlistButton } from "@/components/store/wishlist";
import { cover } from "@/content/covers";
import type { Product } from "@/lib/api/store";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BADGE_LABELS: Record<string, keyof Dictionary["badges"]> = {
  trending: "trend2026",
  new: "new",
  bestseller: "hit",
};

/** Generated artwork for the handful of items that ship without a cover. */
function GeneratedCover({ product }: { product: Product }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{ background: product.cover.gradient ?? "var(--surface-3)" }}
    >
      <span className="text-4xl drop-shadow-sm" aria-hidden>
        {product.cover.icon ?? "◍"}
      </span>
    </div>
  );
}

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
  const image = product.cover.image ?? cover("marketplace", product.slug);
  const href = path(`/store/${product.slug}`, locale);
  const badge = product.badges.find((value) => BADGE_LABELS[value]);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs",
        "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)]",
        "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md",
      )}
    >
      <div className={cn("relative overflow-hidden border-b border-line bg-surface-3", compact ? "aspect-[2/1]" : "aspect-[16/10]")}>
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw"
            className={cn(
              "object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]",
              !product.available && "opacity-60 saturate-50",
            )}
          />
        ) : (
          <GeneratedCover product={product} />
        )}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Badge className="border border-line/60 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] text-ink-2 backdrop-blur-sm">
            {product.categoryLabel}
          </Badge>
          {badge && <Badge tone="accent">{d.badges[BADGE_LABELS[badge]]}</Badge>}
        </div>

        <WishlistButton
          id={product.id}
          locale={locale}
          labels={{ add: d.store.wishlist, added: d.store.inWishlist }}
          className="absolute right-3 bottom-3"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4.5">
        <h3 className="text-[16px] leading-[1.2]">
          <Link href={href} className="outline-offset-4 after:absolute after:inset-0 after:content-['']">
            {product.title}
          </Link>
        </h3>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">{product.summary}</p>

        {product.setupTime && (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {product.setupTime}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
          <div className="flex min-w-0 flex-col gap-1.5">
            {product.rating !== null && <Rating value={product.rating} count={product.reviewCount} />}
            {product.available ? (
              <span className="font-mono text-[16px] leading-none font-medium tabular-nums text-ink">
                {formatPrice(product.priceEur, locale)}
              </span>
            ) : (
              <span className="font-mono text-2xs tracking-[0.1em] text-warning uppercase">{d.store.salesClosed}</span>
            )}
          </div>
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-3 transition-[background-color,color] duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
