import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Package, TrendingUp } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { creatorList, links, revenueShare } from "@/content/site";
import { pick } from "@/content/locale";
import { getStoreCatalog } from "@/lib/api/store";
import { formatNumber, getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.nav.creators, description: d.store.revenueShare };
}

export default async function CreatorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const catalog = await getStoreCatalog(locale);
  const countByCreator = new Map<string, number>();
  for (const product of catalog.products) {
    if (product.creator) countByCreator.set(product.creator.id, (countByCreator.get(product.creator.id) ?? 0) + 1);
  }

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.store.title, href: path("/store", locale) }, { label: d.nav.creators }]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-14">
        <p className="eyebrow">{d.store.revenueShare}</p>
        <h1 className="mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
          {pick(locale, "Кто собирает системы Marketplace", "The people who build what's in the store")}
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">
          {pick(
            locale,
            "Каждый продукт проходит проверку: файлы, инструкции, лицензия и обновления. Автор получает 70% с каждой продажи.",
            "Every product is vetted: files, instructions, licence and updates. The author keeps 70% of every sale.",
          )}
        </p>
      </Container>

      <Container size="wide" className="pb-16">
        <RevealGroup step={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creatorList.map((creator) => (
            <article
              key={creator.id}
              className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md"
            >
              <div className="flex items-center gap-3.5">
                <span
                  className="h-12 w-12 shrink-0 rounded-full border border-line"
                  style={{ background: creator.avatarGradient }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-[17px] leading-tight">
                    <Link href={path(`/store/creators/${creator.slug}`, locale)} className="after:absolute after:inset-0 after:content-['']">
                      {creator.name}
                    </Link>
                    {creator.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
                  </h2>
                  {creator.verified && <p className="text-[12.5px] text-muted">{d.store.verifiedCreator}</p>}
                </div>
              </div>

              <p className="mt-4 line-clamp-3 text-[13.5px] leading-relaxed text-ink-3">
                {pick(locale, creator.bioRu, creator.bioEn)}
              </p>

              <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4">
                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                    <Package className="h-3.5 w-3.5" aria-hidden />
                    {d.home.statsProducts}
                  </dt>
                  <dd className="mt-1 font-mono text-[14px] tabular-nums text-ink">
                    {countByCreator.get(creator.id) ?? creator.productCount}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    {pick(locale, "продаж", "sales")}
                  </dt>
                  <dd className="mt-1 font-mono text-[14px] tabular-nums text-ink">
                    {formatNumber(creator.salesCount, locale)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </RevealGroup>
      </Container>

      <Container size="wide" className="pb-20">
        <div id="apply" className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <Reveal>
                <SectionHead
                  eyebrow={d.store.becomeCreator}
                  title={pick(locale, "Продавайте свои системы через Marketplace", "Sell your systems through the Marketplace")}
                  body={pick(
                    locale,
                    "Мы берём на себя витрину, оплату, лицензии, доставку файлов и поддержку. Вы отвечаете за продукт и обновления.",
                    "We handle the storefront, payments, licensing, file delivery and support. You own the product and its updates.",
                  )}
                  as="h2"
                  className="mb-6"
                />
              </Reveal>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  pick(locale, "70% с каждой продажи", "70% of every sale"),
                  pick(locale, "Версии и обновления файлов", "File versions and updates"),
                  pick(locale, "Три уровня лицензии из коробки", "Three licence tiers out of the box"),
                  pick(locale, "Выплаты и отчётность", "Payouts and reporting"),
                ].map((item) => (
                  <li key={item} className="rounded-md border border-line bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-ink-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-accent/35 bg-accent-soft p-6">
              <p className="eyebrow text-accent-ink">{pick(locale, "Разделение выручки", "Revenue split")}</p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-[3.5rem] leading-none font-extrabold tracking-tight tabular-nums text-ink">
                  {Math.round(revenueShare.creator * 100)}%
                </span>
                <span className="text-[14px] text-ink-2">{pick(locale, "креатору", "to the creator")}</span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-accent" style={{ width: `${revenueShare.creator * 100}%` }} />
              </div>
              <p className="mt-3 text-[12.5px] text-ink-3">
                {Math.round(revenueShare.platform * 100)}% {pick(locale, "остаётся платформе", "stays with the platform")}
              </p>
              <ButtonLink href={links.telegramManager} target="_blank" rel="noreferrer noopener" className="mt-6" full>
                {d.store.becomeCreator}
              </ButtonLink>
              <Badge tone="outline" className="mt-3">
                {pick(locale, "ответ в течение дня", "reply within a day")}
              </Badge>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
