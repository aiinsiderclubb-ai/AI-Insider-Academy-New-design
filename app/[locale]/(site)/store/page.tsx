import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Package } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { EmptyState } from "@/components/primitives/states";
import { ProductCard } from "@/components/store/product-card";
import { ProductCover } from "@/components/store/product-cover";
import { AmbientVideo } from "@/components/store/hover-video";
import { CategoryIndex, type IndexRow } from "@/components/store/category-index";
import { StoreFilterBar, StoreSearch } from "@/components/store/store-controls";
import { pick } from "@/content/locale";
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

  // The featured slot goes to a product that can show itself moving, if there is one.
  const drop =
    catalog.products.find((item) => item.available && item.video) ??
    catalog.products.find((item) => item.available && item.badges.includes("trending")) ??
    catalog.products[0];

  const rated = catalog.products.some((item) => item.rating !== null && item.reviewCount > 0);
  const topRated = [...catalog.products]
    .filter((item) => item.rating !== null && item.reviewCount > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  const showShelves = !filtered && !collection;

  const indexRows: IndexRow[] = storeCategories
    .map((category) => {
      const items = catalog.products.filter((item) => item.categoryId === category.id);
      const onSale = items.filter((item) => item.available);
      const cheapest = onSale.length ? Math.min(...onSale.map((item) => item.priceEur)) : null;
      const covers = [...onSale]
        .sort((a, b) => Number(Boolean(b.video)) - Number(Boolean(a.video)) || b.badges.length - a.badges.length)
        .map((item) => item.slug);
      return {
        slug: category.slug,
        label: pick(locale, category.titleRu, category.titleEn),
        description: pick(locale, category.descRu, category.descEn),
        count: items.length,
        meta:
          cheapest !== null
            ? `${pick(locale, "от", "from")} ${formatPrice(cheapest, locale)}`
            : pick(locale, "скоро", "soon"),
        covers,
        href: path(`/store?category=${category.slug}`, locale),
      };
    })
    .filter((row) => row.count > 0);

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

      <Container size="wide" className={showShelves ? "pt-8 pb-12" : "pt-7 pb-8"}>
        <Reveal className="grid items-end gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div>
            <h1 className="text-[clamp(2.25rem,5vw,3.6rem)] leading-[0.98] tracking-[-0.04em]">{d.store.title}</h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">
              {pick(
                locale,
                `${catalog.products.length} готовых систем: промпты, n8n, агенты, скиллы, голосовые боты. В каждой — файлы, инструкция и обновления. По подписке Pro всё на ${Math.round(tierDiscount.pro * 100)}% дешевле.`,
                `${catalog.products.length} ready systems: prompts, n8n, agents, skills, voice bots. Each comes with files, a guide and updates. ${Math.round(tierDiscount.pro * 100)}% off everything with Pro.`,
              )}
            </p>
          </div>
          <StoreSearch d={d} />
        </Reveal>
      </Container>

      {/* ------------------------------- the index ------------------------------- */}
      {showShelves && (
        <Container size="wide" className="pb-20">
          <CategoryIndex rows={indexRows} />
        </Container>
      )}

      {/* --------------------------------- drop ---------------------------------- */}
      {showShelves && drop && (
        <Container size="wide" className="pb-20">
          <Reveal className="on-dark relative isolate flex min-h-[34rem] flex-col justify-end overflow-hidden rounded-3xl border border-line bg-ground-deep text-ink lg:aspect-[21/9] lg:min-h-0">
            {drop.video ? (
              <AmbientVideo
                src={drop.video}
                poster={drop.video.replace(/\.mp4$/, ".jpg")}
                playLabel={pick(locale, "Включить видео", "Play video")}
                className="-z-10"
              />
            ) : (
              <div className="absolute inset-0 -z-10">
                <ProductCover product={drop} variant="plain" />
              </div>
            )}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "linear-gradient(90deg, rgb(5 5 4 / 0.92) 0%, rgb(5 5 4 / 0.55) 42%, transparent 70%), linear-gradient(0deg, rgb(5 5 4 / 0.85) 0%, transparent 45%)",
              }}
            />

            <div className="flex flex-col gap-5 p-6 sm:p-10 lg:max-w-[42rem] lg:p-14">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{drop.badges.includes("new") ? d.badges.new : d.store.dropOfWeek}</Badge>
                <span className="text-[13px] text-ink-2">{drop.categoryLabel}</span>
              </div>
              <h2 className="font-display text-[clamp(2.2rem,5vw,4.6rem)] leading-[0.92] font-extrabold tracking-[-0.05em]">
                {drop.title}
              </h2>
              <p className="max-w-lg text-[15.5px] leading-relaxed text-ink-2">{drop.summary}</p>
              <div className="flex flex-wrap items-center gap-5 pt-1">
                <ButtonLink href={path(`/store/${drop.slug}`, locale)} size="lg" className="group">
                  {pick(locale, "Смотреть", "See it")}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </ButtonLink>
                <span className="font-display text-[1.9rem] leading-none font-extrabold tracking-tight tabular-nums">
                  {formatPrice(drop.priceEur, locale)}
                </span>
              </div>
            </div>
          </Reveal>
        </Container>
      )}

      {/* ------------------------------ collections ------------------------------ */}
      {showShelves && catalog.bundles.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead
              title={pick(locale, "Наборы", "Bundles")}
              body={pick(
                locale,
                "Несколько систем под одну задачу — дешевле, чем по отдельности.",
                "Several systems for one job — cheaper than buying them one by one.",
              )}
              as="h2"
            />
          </Reveal>
          <div className="scroll-x -mx-5 px-5 pb-2 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-5 sm:grid sm:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.bundles.slice(0, 6).map((bundle) => {
                const saving = bundle.fullPriceEur > 0 ? Math.round((bundle.savingEur / bundle.fullPriceEur) * 100) : 0;
                return (
                  <li key={bundle.id} className="w-76 sm:w-auto">
                    <Link
                      href={path(`/store?collection=${bundle.vertical}`, locale)}
                      className="group flex h-full flex-col gap-5 rounded-2xl border border-line bg-surface p-5 transition-[border-color,background-color] duration-300 hover:border-line-2 hover:bg-surface-2"
                    >
                      {/* The bundle's own products, fanned like a hand of cards. */}
                      <div aria-hidden className="relative h-36">
                        {bundle.products.slice(0, 3).map((item, layer) => (
                          <div
                            key={item.id}
                            className="absolute top-3 left-1/2 h-[7.25rem] w-[12.75rem] overflow-hidden rounded-md border border-line bg-ground shadow-lg transition-transform duration-500 ease-[var(--ease-out-quart)]"
                            style={{
                              zIndex: 3 - Math.abs(layer - 1),
                              transform: `translateX(calc(-50% + ${(layer - 1) * 58}px)) rotate(${(layer - 1) * 6}deg)`,
                            }}
                          >
                            <Image src={`/covers/shelf/${item.slug}.jpg`} alt="" fill sizes="204px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-display text-[19px] leading-tight font-extrabold tracking-tight text-ink">{bundle.title}</p>
                          <p className="mt-1 text-[13px] text-muted">
                            {bundle.products.length} {pick(locale, "систем в наборе", "systems inside")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-[18px] font-medium text-ink tabular-nums">{formatPrice(bundle.priceEur, locale)}</p>
                          {saving > 0 && (
                            <p className="mt-0.5 text-[12px] text-accent-ink tabular-nums">
                              −{saving}% <span className="text-faint line-through">{formatPrice(bundle.fullPriceEur, locale)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      )}

      {/* -------------------------------- catalogue ------------------------------ */}
      <Container size="wide" className="pb-24" id="catalogue">
        {showShelves && (
          <Reveal>
            <SectionHead title={pick(locale, "Весь каталог", "Everything")} as="h2" className="mb-5" />
          </Reveal>
        )}
        <div className="sticky top-16 z-20 -mx-5 mb-8 border-b border-line bg-[color-mix(in_oklab,var(--ground)_88%,transparent)] px-5 py-3 backdrop-blur-xl sm:-mx-7 sm:px-7">
          <StoreFilterBar
            d={d}
            rated={rated}
            total={scoped.length}
            categories={facets.map((facet) => ({ slug: facet.slug, label: pick(locale, facet.titleRu, facet.titleEn), count: facet.count }))}
          />
        </div>

        <p className="mb-6 text-[13px] text-muted tabular-nums">{resultCount(results.length, locale, d)}</p>

        {results.length ? (
          <RevealGroup step={45} className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
      </Container>

      {/* --------------------------------- shelves ------------------------------- */}
      {showShelves && topRated.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead title={d.store.bestSellers} as="h2" />
          </Reveal>
          <RevealGroup step={60} className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {topRated.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} d={d} compact />
            ))}
          </RevealGroup>
        </Container>
      )}
    </>
  );
}
