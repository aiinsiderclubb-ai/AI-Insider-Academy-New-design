import type { Metadata } from "next";
import { ArrowRight, Check, Package } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { EmptyState } from "@/components/primitives/states";
import { ProductCard } from "@/components/store/product-card";
import { ProductCover } from "@/components/store/product-cover";
import { AmbientVideo } from "@/components/store/hover-video";
import { SaleCountdown } from "@/components/store/sale-countdown";
import { StoreFilterBar, StoreSearch } from "@/components/store/store-controls";
import { pick } from "@/content/locale";
import {
  categoryFacets,
  filterProducts,
  getStoreCatalog,
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

  // What can be bought now leads; announced items wait on their own shelf below.
  const onSale = scoped.filter((item) => item.available);
  const upcoming = scoped.filter((item) => !item.available);

  const band = query.price ? PRICE_BANDS[query.price] : undefined;
  const results = filterProducts(onSale, {
    q: query.q,
    category: query.category,
    sort: (query.sort as SortKey) ?? "popular",
    min: band?.[0],
    max: band?.[1],
    minRating: query.rating ? Number(query.rating) : undefined,
    badge: query.badge,
  });

  const facets = categoryFacets(onSale).filter((facet) => facet.count > 0);
  const soonResults = filterProducts(upcoming, { q: query.q, category: query.category, sort: "popular" });
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
                `${catalog.products.length} готовых систем: промпты, n8n, агенты, скиллы, голосовые боты. В каждой — файлы, инструкция и обновления.`,
                `${catalog.products.length} ready systems: prompts, n8n, agents, skills, voice bots. Each comes with files, a guide and updates.`,
              )}
            </p>
          </div>
          <StoreSearch d={d} />
        </Reveal>
      </Container>

      {/* ------------------------------ opening sale ----------------------------- */}
      {catalog.sale && (
        <Container size="wide" className="pb-10">
          <Reveal className="relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div
              aria-hidden
              className="absolute inset-y-0 -left-10 -z-10 w-40 -skew-x-12 opacity-25"
              style={{ background: "repeating-linear-gradient(90deg, var(--accent) 0 10px, transparent 10px 22px)" }}
            />
            <div>
              <p className="font-display text-[clamp(1.35rem,2.6vw,1.9rem)] leading-tight font-extrabold tracking-tight text-ink">
                {pick(locale, `В честь открытия — всё по ${formatPrice(catalog.sale.priceEur, locale)}`, `Opening week — everything ${formatPrice(catalog.sale.priceEur, locale)}`)}
              </p>
              <p className="mt-1 text-[13.5px] text-ink-2">
                {pick(
                  locale,
                  "Все готовые системы магазина с личной лицензией. Остальные ещё в разработке — добавляем каждый день.",
                  "Every ready system in the store, personal license. The rest are still being built — more every day.",
                )}
              </p>
            </div>
            <p className="flex shrink-0 items-baseline gap-2.5">
              <span className="text-[12.5px] text-ink-3">{pick(locale, "До конца", "Ends in")}</span>
              <SaleCountdown endsAt={catalog.sale.endsAt} className="font-mono text-[1.6rem] font-medium text-accent-ink tabular-nums" />
            </p>
          </Reveal>
        </Container>
      )}

      {/* -------------------------------- catalogue ------------------------------ */}
      <Container size="wide" className="pb-24" id="catalogue">
        {showShelves && (
          <Reveal>
            <SectionHead
              title={
                catalog.sale
                  ? pick(locale, `Всё по ${formatPrice(catalog.sale.priceEur, locale)}`, `Everything at ${formatPrice(catalog.sale.priceEur, locale)}`)
                  : pick(locale, "В продаже", "On sale now")
              }
              as="h2"
              className="mb-5"
            />
          </Reveal>
        )}
        <div className="sticky top-16 z-20 -mx-5 mb-8 border-b border-line bg-[color-mix(in_oklab,var(--ground)_88%,transparent)] px-5 py-3 backdrop-blur-xl sm:-mx-7 sm:px-7">
          <StoreFilterBar
            d={d}
            rated={rated}
            total={onSale.length}
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

      {/* ---------------------------------- soon ---------------------------------- */}
      {soonResults.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead
              eyebrow={d.badges.soon}
              title={pick(locale, "Скоро в магазине", "Coming to the store")}
              body={pick(locale, "Эти системы ещё дописываем — добавляем каждый день.", "Still being finished — new ones land every day.")}
              as="h2"
            />
          </Reveal>
          <RevealGroup step={40} className="grid gap-x-6 gap-y-10 opacity-80 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {soonResults.map((product: Product) => (
              <ProductCard key={product.id} product={product} locale={locale} d={d} compact />
            ))}
          </RevealGroup>
        </Container>
      )}

      {/* --------------------------------- drop ---------------------------------- */}
      {showShelves && drop && (
        <Container size="wide" className="pb-20">
          <Reveal className="drop-card on-dark relative isolate overflow-hidden rounded-[32px] border border-line-2 text-ink">
            <div className="grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:p-14">
              {/* ------------------------------ the pitch ------------------------------ */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone="accent">{drop.badges.includes("new") ? d.badges.new : d.store.dropOfWeek}</Badge>
                  <span className="font-mono text-[11.5px] tracking-[0.16em] text-ink-3 uppercase">{drop.categoryLabel}</span>
                </div>
                <h2 className="drop-title mt-6 font-display text-[clamp(2.6rem,5.4vw,4.75rem)] leading-[0.9] font-extrabold tracking-[-0.05em]">
                  {drop.title}
                </h2>
                <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink-2">{drop.summary}</p>

                {drop.included.length > 0 && (
                  <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
                    {drop.included.slice(0, 4).map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span className="line-clamp-2">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-line-2 pt-7">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-[2.6rem] leading-none font-extrabold tracking-tight text-ink tabular-nums">
                      {formatPrice(drop.priceEur, locale)}
                    </span>
                    {drop.listPriceEur !== null && drop.listPriceEur > drop.priceEur && (
                      <>
                        <span className="font-mono text-[15px] text-ink-3 line-through tabular-nums">
                          {formatPrice(drop.listPriceEur, locale)}
                        </span>
                        <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[12px] font-semibold text-on-accent tabular-nums">
                          −{Math.round((1 - drop.priceEur / drop.listPriceEur) * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                  <ButtonLink href={path(`/store/${drop.slug}`, locale)} size="lg" className="group">
                    {pick(locale, "Смотреть", "See it")}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                  </ButtonLink>
                </div>
              </div>

              {/* ------------------------------ the screen ------------------------------ */}
              <div className="drop-screen relative">
                <span aria-hidden className="drop-screen-glow" />
                <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl">
                  <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" aria-hidden />
                    <span className="ml-3 truncate font-mono text-[11px] tracking-[0.12em] text-white/45 uppercase">
                      {drop.video ? `${drop.title} · ${pick(locale, "шоурил", "showreel")}` : drop.title}
                    </span>
                  </div>
                  <div className="relative aspect-video">
                    {drop.video ? (
                      <AmbientVideo
                        src={drop.video}
                        poster={drop.video.replace(/\.mp4$/, ".jpg")}
                        playLabel={pick(locale, "Включить видео", "Play video")}
                      />
                    ) : (
                      <div className="absolute inset-0">
                        <ProductCover product={drop} variant="plain" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      )}

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
