import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Check, Clock, FileArchive, ListChecks, Package, Wallet } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs, Accordion, AccordionItem } from "@/components/primitives/navigation";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal } from "@/components/motion/reveal";
import { Rating } from "@/components/primitives/display";
import { Note } from "@/components/primitives/states";
import { ProductCard } from "@/components/store/product-card";
import { FreePreview, LicensePicker } from "@/components/store/license-picker";
import { WishlistButton } from "@/components/store/wishlist";
import { cover } from "@/content/covers";
import { pick } from "@/content/locale";
import { tierDiscount } from "@/content/store";
import { getProduct } from "@/lib/api/store";
import { getAccess } from "@/lib/api/session";
import { formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 180;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale, product: slug } = await params;
  const found = await getProduct(slug, locale as Locale);
  if (!found) return {};
  return {
    title: found.product.title,
    description: found.product.summary,
    openGraph: { title: found.product.title, description: found.product.summary },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale: raw, product: slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const found = await getProduct(slug, locale);
  if (!found) notFound();

  const { product, related, inBundles } = found;
  const access = await getAccess();
  const owned = access.productIds.has(product.id);
  const discount = access.tier === "pro" ? tierDiscount.pro : access.tier === "club" ? tierDiscount.club : undefined;

  const image = product.cover.image ?? cover("marketplace", product.slug);

  const setupSteps = [
    pick(locale, "Оплатите продукт", "Pay for the product"),
    pick(locale, "Откройте Библиотеку в кабинете", "Open Library in your account"),
    pick(locale, "Скачайте архив и следуйте PDF-гайду", "Download the archive and follow the PDF guide"),
  ];

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.store.title, href: path("/store", locale) },
            { label: product.categoryLabel, href: path(`/store?category=${product.categorySlug}`, locale) },
            { label: product.title },
          ]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-14">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ----------------------------- main column ---------------------------- */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">{product.categoryLabel}</Badge>
              {product.badges.includes("trending") && <Badge tone="accent">{d.badges.trend2026}</Badge>}
              {product.badges.includes("new") && <Badge tone="accent">{d.badges.new}</Badge>}
              {!product.available && <Badge tone="warning">{d.badges.soon}</Badge>}
            </div>

            <div className="mt-5 flex items-start gap-4">
              <h1 className="min-w-0 flex-1 text-[clamp(2rem,4.4vw,3.25rem)] leading-[1] tracking-[-0.04em]">
                {product.title}
              </h1>
              <WishlistButton
                id={product.id}
                labels={{ add: d.store.wishlist, added: d.store.inWishlist }}
                className="mt-1.5 shrink-0"
              />
            </div>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">{product.summary}</p>

            {product.rating !== null && (
              <div className="mt-4">
                <Rating value={product.rating} count={product.reviewCount} size={15} />
              </div>
            )}

            <div className="relative mt-7 aspect-[16/9] overflow-hidden rounded-lg border border-line bg-surface-3">
              {image ? (
                <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
              ) : (
                <div
                  className="absolute inset-0 grid place-items-center text-6xl"
                  style={{ background: product.cover.gradient ?? "var(--surface-3)" }}
                  aria-hidden
                >
                  {product.cover.icon ?? "◍"}
                </div>
              )}
            </div>

            {/* -------------------------- outcome strip -------------------------- */}
            {(product.outcome || product.setupTime || product.priceModel) && (
              <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
                {product.outcome && (
                  <div className="bg-surface p-4 sm:col-span-3">
                    <dt className="eyebrow">{pick(locale, "Результат", "Outcome")}</dt>
                    <dd className="mt-2 text-[14.5px] leading-snug text-ink">{product.outcome}</dd>
                  </div>
                )}
                {product.setupTime && (
                  <div className="bg-surface p-4">
                    <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {pick(locale, "Внедрение", "Setup")}
                    </dt>
                    <dd className="mt-1.5 text-[14px] font-medium text-ink">{product.setupTime}</dd>
                  </div>
                )}
                {product.priceModel && (
                  <div className="bg-surface p-4">
                    <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Wallet className="h-3.5 w-3.5" aria-hidden />
                      {pick(locale, "Модель услуги", "Service model")}
                    </dt>
                    <dd className="mt-1.5 text-[14px] font-medium text-ink">{product.priceModel}</dd>
                  </div>
                )}
                {product.fileTypes.length > 0 && (
                  <div className="bg-surface p-4">
                    <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                      <FileArchive className="h-3.5 w-3.5" aria-hidden />
                      {d.store.formats}
                    </dt>
                    <dd className="mt-1.5 font-mono text-[13px] text-ink">{product.fileTypes.join(" · ")}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* --------------------------- free preview -------------------------- */}
            {product.freePreview && (
              <div className="mt-8">
                <FreePreview title={product.freePreview.title} content={product.freePreview.content} d={d} />
              </div>
            )}

            {/* ---------------------------- what's inside ------------------------ */}
            {product.included.length > 0 && (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 text-[19px]">
                  <ListChecks className="h-4.5 w-4.5 text-accent" aria-hidden />
                  {d.store.whatsInside}
                </h2>
                <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                  {product.included.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 bg-surface p-4 text-[14px] leading-snug text-ink-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* -------------------------------- setup ---------------------------- */}
            <section className="mt-10">
              <h2 className="text-[19px]">{d.store.setup}</h2>
              <ol className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line">
                {setupSteps.map((step, index) => (
                  <li key={step} className="flex items-center gap-3.5 bg-surface px-5 py-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent-soft font-mono text-[11px] tabular-nums text-accent-ink">
                      {index + 1}
                    </span>
                    <span className="text-[14px] text-ink-2">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12.5px] text-muted">
                {pick(locale, "Требуется аккаунт AI Insider Academy.", "An AI Insider Academy account is required.")}
              </p>
            </section>

            {/* ------------------------------ reviews ---------------------------- */}
            <section className="mt-10">
              <h2 className="text-[19px]">{pick(locale, "Отзывы покупателей", "Buyer reviews")}</h2>
              {product.reviewCount > 0 && product.rating !== null ? (
                <div className="mt-4 flex flex-wrap items-center gap-6 rounded-lg border border-line bg-surface p-5">
                  <div>
                    <p className="font-display text-[2.5rem] leading-none font-extrabold tracking-tight tabular-nums">
                      {product.rating.toFixed(1)}
                    </p>
                    <Rating value={product.rating} size={14} className="mt-2" />
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-ink-3">
                    {product.reviewCount} {d.store.reviewsCount}
                    <br />
                    {pick(
                      locale,
                      "Отзывы оставляют только покупатели с подтверждённым заказом.",
                      "Only buyers with a confirmed order can leave a review.",
                    )}
                  </p>
                </div>
              ) : (
                <Note tone="neutral" className="mt-4">
                  {d.store.noReviews}
                </Note>
              )}
            </section>

            {/* -------------------------------- faq ------------------------------ */}
            {product.faq.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-4 text-[19px]">{d.learn.faq}</h2>
                <Accordion>
                  {product.faq.map((entry) => (
                    <AccordionItem key={entry.q} name="product-faq" title={entry.q}>
                      {entry.a}
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}
          </div>

          {/* ------------------------------- buy rail ---------------------------- */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            {owned ? (
              <div className="rounded-lg border border-success/35 bg-success-soft p-5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-success">
                  <Check className="h-4 w-4" aria-hidden />
                  {pick(locale, "Продукт у вас есть", "You own this product")}
                </p>
                <Link
                  href={path("/app/library", locale)}
                  className="mt-3 inline-block text-[13.5px] font-medium text-accent-ink underline-offset-4 hover:underline"
                >
                  {d.app.library}
                </Link>
              </div>
            ) : (
              <LicensePicker
                slug={product.slug}
                licenses={product.licenses}
                locale={locale}
                d={d}
                available={product.available}
                discountPercent={discount}
              />
            )}

            {product.creator && (
              <div className="rounded-lg border border-line bg-surface p-5">
                <p className="eyebrow">{d.store.author}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className="h-10 w-10 shrink-0 rounded-full border border-line"
                    style={{ background: product.creator.gradient }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                      {product.creator.name}
                      {product.creator.verified && <BadgeCheck className="h-4 w-4 text-accent" aria-hidden />}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {product.creator.verified ? d.store.verifiedCreator : d.store.author}
                    </p>
                  </div>
                </div>
                <Link
                  href={path(`/store/creators/${product.creator.slug}`, locale)}
                  className="mt-4 inline-block text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
                >
                  {d.common.showAll}
                </Link>
              </div>
            )}

            {!discount && (
              <Note>
                {pick(
                  locale,
                  `Подписка Pro снижает цену на ${Math.round(tierDiscount.pro * 100)}%, Club — на ${Math.round(tierDiscount.club * 100)}%.`,
                  `A Pro plan takes ${Math.round(tierDiscount.pro * 100)}% off, Club takes ${Math.round(tierDiscount.club * 100)}%.`,
                )}
              </Note>
            )}
          </aside>
        </div>
      </Container>

      {/* -------------------------------- bundles -------------------------------- */}
      {inBundles.length > 0 && (
        <Container size="wide" className="pb-16">
          <Reveal>
            <SectionHead
              eyebrow={d.store.bundle}
              title={pick(locale, "Входит в наборы", "Part of these sets")}
              body={pick(locale, "Взять вместе выгоднее, чем по отдельности.", "Taking the set costs less than the pieces.")}
              as="h2"
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inBundles.map((bundle) => (
              <Link
                key={bundle.id}
                href={path(`/store?collection=${bundle.vertical}`, locale)}
                className="group flex flex-col justify-between gap-5 rounded-lg border border-line bg-surface p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md"
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
            ))}
          </div>
        </Container>
      )}

      {/* -------------------------------- related -------------------------------- */}
      {related.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead eyebrow={product.categoryLabel} title={d.store.related} as="h2" />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} locale={locale} d={d} compact />
            ))}
          </div>
        </Container>
      )}
    </>
  );
}
