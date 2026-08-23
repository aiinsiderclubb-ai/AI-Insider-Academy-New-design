import Image from "next/image";
import Link from "next/link";
import { Check, Gift } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { cover } from "@/content/covers";
import { pick } from "@/content/locale";
import type { CourseBundle, VaultProduct } from "@/content/catalog";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function BundleCard({
  bundle,
  locale,
  d,
  featured,
}: {
  bundle: CourseBundle;
  locale: Locale;
  d: Dictionary;
  featured?: boolean;
}) {
  const saving = bundle.oldPriceEur - bundle.priceEur;
  const bonuses = pick(locale, bundle.bonusRu, bundle.bonusEn);

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-surface p-6 shadow-xs",
        featured ? "border-accent/45 ring-1 ring-accent/15" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{d.nav.bundles}</span>
        {featured && <Badge tone="accent">{d.plans.bestValue}</Badge>}
      </div>

      <h3 className="mt-4 text-[21px] leading-tight">{bundle.title}</h3>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-3">{pick(locale, bundle.descRu, bundle.descEn)}</p>

      <ul className="mt-5 flex flex-wrap gap-1.5">
        {bundle.includes.map((item) => (
          <li
            key={item}
            className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2"
          >
            {item}
          </li>
        ))}
      </ul>

      {bonuses.length > 0 && (
        <div className="mt-5 rounded-md border border-line bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
            <Gift className="h-3.5 w-3.5 text-accent" aria-hidden />
            {d.learn.bonuses}
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {bonuses.map((bonus) => (
              <li key={bonus} className="flex gap-2 text-[13px] leading-snug text-ink-3">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                {bonus}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6">
        <span className="font-display text-[clamp(1.75rem,2.6vw,2.25rem)] leading-none font-extrabold tracking-tight tabular-nums">
          {formatPrice(bundle.priceEur, locale)}
        </span>
        <span className="font-mono text-[13px] text-faint line-through tabular-nums">
          {formatPrice(bundle.oldPriceEur, locale)}
        </span>
        {saving > 0 && (
          <Badge tone="success">
            {d.learn.savings} {formatPrice(saving, locale)}
          </Badge>
        )}
      </div>

      <ButtonLink href={path(`/learn/bundles/${bundle.id}`, locale)} className="mt-5" full>
        {d.common.more}
      </ButtonLink>
    </article>
  );
}

export function VaultCard({
  product,
  locale,
  d,
}: {
  product: VaultProduct;
  locale: Locale;
  d: Dictionary;
}) {
  const image = cover("vault", product.id) ?? product.coverImage;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-surface-3">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Badge className="border border-line/60 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] text-ink-2 backdrop-blur-sm">
            {product.categoryRu}
          </Badge>
          <Badge tone="accent">{pick(locale, product.highlightRu, product.highlightEn)}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="text-[17px] leading-tight">
          <Link href={path(`/store?collection=vault&q=${encodeURIComponent(product.titleRu)}`, locale)} className="after:absolute after:inset-0 after:content-['']">
            {pick(locale, product.titleRu, product.titleEn)}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">
          {pick(locale, product.shortRu, product.shortEn)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="font-mono text-[16px] leading-none font-medium tabular-nums text-ink">
            {formatPrice(product.priceEur, locale)}
          </span>
          <span className="text-[12.5px] text-muted">{d.store.lifetimeUpdates}</span>
        </div>
      </div>
    </article>
  );
}
