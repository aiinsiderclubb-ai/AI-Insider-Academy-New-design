import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Package, TrendingUp } from "lucide-react";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal } from "@/components/motion/reveal";
import { EmptyState } from "@/components/primitives/states";
import { ProductCard } from "@/components/store/product-card";
import { creatorList } from "@/content/site";
import { pick } from "@/content/locale";
import { getStoreCatalog } from "@/lib/api/store";
import { formatNumber, getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 600;

export function generateStaticParams() {
  return creatorList.map((creator) => ({ slug: creator.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const creator = creatorList.find((item) => item.slug === slug);
  if (!creator) return {};
  return { title: creator.name, description: pick(locale as Locale, creator.bioRu, creator.bioEn) };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const creator = creatorList.find((item) => item.slug === slug);
  if (!creator) notFound();

  const catalog = await getStoreCatalog(locale);
  const products = catalog.products.filter((product) => product.creator?.id === creator.id);

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.store.title, href: path("/store", locale) },
            { label: d.nav.creators, href: path("/store/creators", locale) },
            { label: creator.name },
          ]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-12">
        <div className="flex flex-wrap items-start gap-6">
          <span
            className="h-20 w-20 shrink-0 rounded-2xl border border-line"
            style={{ background: creator.avatarGradient }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2.5 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight tracking-[-0.035em]">
              {creator.name}
              {creator.verified && <BadgeCheck className="h-6 w-6 text-accent" aria-hidden />}
            </h1>
            <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
              {pick(locale, creator.bioRu, creator.bioEn)}
            </p>

            <dl className="mt-6 flex flex-wrap gap-x-9 gap-y-3">
              <div>
                <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  {d.home.statsProducts}
                </dt>
                <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink">{products.length || creator.productCount}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                  {pick(locale, "продаж", "sales")}
                </dt>
                <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink">{formatNumber(creator.salesCount, locale)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {pick(locale, "в Marketplace с", "on the marketplace since")}
                </dt>
                <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink">{creator.joinedAt}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Container>

      <Container size="wide" className="pb-20">
        <Reveal>
          <SectionHead eyebrow={d.store.title} title={pick(locale, "Продукты автора", "Products by this creator")} as="h2" />
        </Reveal>
        {products.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} d={d} compact />
            ))}
          </div>
        ) : (
          <EmptyState title={d.states.emptyTitle} body={d.store.emptyBody} />
        )}
      </Container>
    </>
  );
}
