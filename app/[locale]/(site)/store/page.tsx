import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Package, Sparkles, Wallet } from "lucide-react";
import { Badge, Stat } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { EmptyState } from "@/components/primitives/states";
import { ProductCard } from "@/components/store/product-card";
import { StoreFacets, StoreSearch, StoreSort } from "@/components/store/store-controls";
import { cover } from "@/content/covers";
import { pick } from "@/content/locale";
import { revenueShare } from "@/content/site";
import { tierDiscount } from "@/content/store";
import {
  categoryFacets,
  filterProducts,
  getStoreCatalog,
  storeCategories,
  type Product,
  type StoreSort as SortKey,
} from "@/lib/api/store";
import { formatPrice, getDictionary, path, resultCount, type Locale } from "@/lib/i18n";

export const revalidate = 180;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.store.title, description: d.store.body };
}

const PRICE_BANDS: Record<string, [number, number]> = {
  "0-29": [0, 29],
  "30-79": [30, 79],
  "80-149": [80, 149],
  "150+": [150, 99999],
};

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string; price?: string; rating?: string; badge?: string; collection?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const query = await searchParams;
  const d = getDictionary(locale);

  const catalog = await getStoreCatalog(locale);

  const collection = query.collection;
  const collectionBundle = collection ? catalog.bundles.filter((bundle) => bundle.vertical === collection) : [];
  const collectionIds = new Set(collectionBundle.flatMap((bundle) => bundle.productIds));

  const scoped = collection && collectionIds.size ? catalog.products.filter((item) => collectionIds.has(item.id)) : catalog.products;

  const band = query.price ? PRICE_BANDS[query.price] : undefined;
  const results = filterProducts(scoped, {
    q: query.q,
    category: query.category,
    sort: (query.sort as SortKey) ?? "popular",
    min: band?.[0],
    max: band?.[1],
    minRating: query.rating ? Number(query.rating) : undefined,
    badge: query.badge,
  });

  const facets = categoryFacets(scoped);
  const filtered = Boolean(query.q || query.category || query.price || query.rating || query.badge);

  const drop = catalog.products.find((item) => item.available && item.badges.includes("trending")) ?? catalog.products[0];
  const dropImage = drop ? (drop.cover.image ?? cover("marketplace", drop.slug)) : null;

  const newArrivals = catalog.products.filter((item) => item.badges.includes("new")).slice(0, 4);
  const topRated = [...catalog.products]
    .filter((item) => item.rating)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  const showShelves = !filtered && !collection;

  return (
    <>
      {/* ---------------------------------- hero --------------------------------- */}
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.brand.name, href: path("/", locale) },
            { label: d.store.title },
            ...(collection ? [{ label: collection.toUpperCase() }] : []),
          ]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-10">
        <div className="grid gap-x-14 gap-y-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Reveal>
            <p className="eyebrow">{d.store.subtitle}</p>
            <h1 className="mt-5 text-[clamp(2.25rem,5.4vw,3.75rem)] leading-[0.98] tracking-[-0.04em]">
              {d.store.title}
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">{d.store.body}</p>
            <StoreSearch d={d} className="mt-7 max-w-xl" />
          </Reveal>

          <RevealGroup step={70} as="dl" className="grid grid-cols-2 gap-x-6 gap-y-6 self-end">
            <Stat value={catalog.products.length} label={d.home.statsProducts} />
            <Stat value={storeCategories.length} label={d.store.categories} />
            <Stat value={`${Math.round(revenueShare.creator * 100)}%`} label={pick(locale, "креатору с продажи", "to the creator")} />
            <Stat value={`−${Math.round(tierDiscount.pro * 100)}%`} label={pick(locale, "по подписке Pro", "with a Pro plan")} />
          </RevealGroup>
        </div>
      </Container>

      {/* --------------------------------- drop ---------------------------------- */}
      {showShelves && drop && (
        <Container size="wide" className="pb-14">
          <Reveal className="grid overflow-hidden rounded-3xl border border-line bg-surface shadow-xs lg:grid-cols-[1.05fr_1fr]">
            <div className="relative aspect-[16/10] lg:aspect-auto">
              {dropImage ? (
                <Image src={dropImage} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              ) : (
                <div className="absolute inset-0" style={{ background: drop.cover.gradient ?? "var(--surface-3)" }} />
              )}
            </div>
            <div className="flex flex-col justify-center gap-5 border-t border-line p-7 sm:p-10 lg:border-t-0 lg:border-l">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {d.store.dropOfWeek}
                </Badge>
                <Badge tone="outline">{drop.categoryLabel}</Badge>
              </div>

              <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.03]">{drop.title}</h2>
              <p className="max-w-md text-[14.5px] leading-relaxed text-ink-2">{drop.summary}</p>

              {drop.outcome && (
                <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-snug text-ink-2">
                  <span className="eyebrow mr-2">{pick(locale, "Результат", "Outcome")}</span>
                  {drop.outcome}
                </p>
              )}

              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {drop.setupTime && (
                  <div>
                    <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {pick(locale, "Внедрение", "Setup")}
                    </dt>
                    <dd className="mt-1 text-[14px] font-medium text-ink">{drop.setupTime}</dd>
                  </div>
                )}
                {drop.priceModel && (
                  <div>
                    <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Wallet className="h-3.5 w-3.5" aria-hidden />
                      {pick(locale, "Модель услуги", "Service model")}
                    </dt>
                    <dd className="mt-1 text-[14px] font-medium text-ink">{drop.priceModel}</dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap items-center gap-4">
                <span className="font-display text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">
                  {formatPrice(drop.priceEur, locale)}
                </span>
                <ButtonLink href={path(`/store/${drop.slug}`, locale)} size="lg" className="group">
                  {d.common.open}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </Container>
      )}

      {/* ------------------------------ collections ------------------------------ */}
      {showShelves && catalog.bundles.length > 0 && (
        <Container size="wide" className="pb-14">
          <Reveal>
            <SectionHead
              eyebrow={d.store.collections}
              title={pick(locale, "Наборы вместо россыпи", "Sets, not a scatter of files")}
              body={pick(
                locale,
                "Собранные подборки под задачу — дешевле, чем брать позиции по отдельности.",
                "Curated sets built around one job — cheaper than buying the pieces separately.",
              )}
              as="h2"
            />
          </Reveal>
          <div className="scroll-x -mx-5 px-5 pb-2 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-4 sm:grid sm:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.bundles.slice(0, 6).map((bundle) => (
                <li key={bundle.id} className="w-72 sm:w-auto">
                  <Link
                    href={path(`/store?collection=${bundle.vertical}`, locale)}
                    className="group flex h-full flex-col justify-between gap-5 rounded-lg border border-line bg-surface p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-accent" aria-hidden />
                        <span className="eyebrow">{d.store.bundle}</span>
                      </div>
                      <p className="mt-3 text-[17px] font-extrabold tracking-tight text-ink">{bundle.title}</p>
                      <p className="mt-1.5 text-[12.5px] text-muted">
                        {bundle.products.length} {pick(locale, "позиций", "items")}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[17px] font-medium tabular-nums text-ink">
                        {formatPrice(bundle.priceEur, locale)}
                      </span>
                      {bundle.savingEur > 0 && (
                        <span className="font-mono text-[12px] text-faint line-through tabular-nums">
                          {formatPrice(bundle.fullPriceEur, locale)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      )}

      {/* -------------------------------- catalogue ------------------------------ */}
      <Container size="wide" className="pb-20">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <StoreFacets d={d} categories={facets.map((facet) => ({ slug: facet.slug, label: pick(locale, facet.titleRu, facet.titleEn), count: facet.count }))} />
          </aside>

          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <p className="text-[13px] text-muted tabular-nums">{resultCount(results.length, locale, d)}</p>
              <StoreSort d={d} />
            </div>

            {results.length ? (
              <RevealGroup step={45} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((product: Product) => (
                  <ProductCard key={product.id} product={product} locale={locale} d={d} />
                ))}
              </RevealGroup>
            ) : (
              <EmptyState
                icon={<Package className="h-5 w-5" aria-hidden />}
                title={d.store.emptyTitle}
                body={d.store.emptyBody}
                action={
                  <ButtonLink href={path("/store", locale)} size="sm">
                    {d.common.clearFilters}
                  </ButtonLink>
                }
              />
            )}
          </div>
        </div>
      </Container>

      {/* --------------------------------- shelves ------------------------------- */}
      {showShelves && newArrivals.length > 0 && (
        <Container size="wide" className="pb-16">
          <Reveal>
            <SectionHead eyebrow={d.store.newArrivals} title={d.store.newArrivals} as="h2" />
          </Reveal>
          <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} d={d} compact />
            ))}
          </RevealGroup>
        </Container>
      )}

      {showShelves && topRated.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead eyebrow={d.store.bestSellers} title={d.store.bestSellers} as="h2" />
          </Reveal>
          <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topRated.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} d={d} compact />
            ))}
          </RevealGroup>
        </Container>
      )}
    </>
  );
}
