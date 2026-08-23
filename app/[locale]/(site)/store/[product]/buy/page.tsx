import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs, Accordion, AccordionItem } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { CheckoutForm, type CheckoutTier } from "@/components/checkout/checkout-form";
import { cover } from "@/content/covers";
import { pick } from "@/content/locale";
import { legalIsDraft } from "@/content/site";
import { getProduct } from "@/lib/api/store";
import { getCheckoutStatus, type ProviderId } from "@/lib/api/checkout";
import { getSession } from "@/lib/api/session";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale, product: slug } = await params;
  const found = await getProduct(slug, locale as Locale);
  return { title: found?.product.title, robots: { index: false } };
}

export default async function BuyProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; product: string }>;
  searchParams: Promise<{ license?: string }>;
}) {
  const { locale: raw, product: slug } = await params;
  const { license } = await searchParams;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const found = await getProduct(slug, locale);
  if (!found) notFound();
  const { product } = found;

  const [status, user] = await Promise.all([getCheckoutStatus(), getSession()]);

  const tiers: CheckoutTier[] = product.licenses.map((item) => ({
    id: item.id,
    label: item.label,
    note: item.note,
    priceEur: item.priceEur,
    itemId: product.id,
  }));

  const providerLabels: Record<ProviderId, { name: string; note: string }> = {
    stripe: { name: "Stripe", note: "Visa · Mastercard" },
    liqpay: { name: "LiqPay", note: pick(locale, "Украина", "Ukraine") },
    tribute: { name: "Tribute", note: pick(locale, "Карта, СБП, Stars, TON", "Card, SBP, Stars, TON") },
    demo: { name: "Demo", note: pick(locale, "Тестовая оплата", "Test payment") },
  };

  const image = product.cover.image ?? cover("marketplace", product.slug);

  return (
    <Container size="wide" className="pt-8 pb-20">
      <Breadcrumbs
        label={d.common.breadcrumb}
        items={[
          { label: d.store.title, href: path("/store", locale) },
          { label: product.title, href: path(`/store/${product.slug}`, locale) },
          { label: d.checkout.title },
        ]}
      />

      <div className="mt-7 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <Badge tone="outline">{product.categoryLabel}</Badge>
          <h1 className="mt-4 text-[clamp(1.9rem,4.2vw,3rem)] leading-[1] tracking-[-0.04em]">{product.title}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{product.summary}</p>

          {image && (
            <div className="relative mt-7 aspect-[16/9] overflow-hidden rounded-lg border border-line bg-surface-3">
              <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
            </div>
          )}

          {product.included.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[19px]">{d.store.whatsInside}</h2>
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

          <section className="mt-8">
            <h2 className="text-[19px]">{d.store.licenseTitle}</h2>
            <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
              {product.licenses.map((item) => (
                <li key={item.id} className="bg-surface p-4">
                  <p className="text-[14px] font-semibold text-ink">{item.label}</p>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{item.note}</p>
                  <p className="mt-3 font-mono text-[12px] text-muted">
                    {item.clientLimit === null
                      ? pick(locale, "клиентов без ограничений", "unlimited clients")
                      : `${pick(locale, "до", "up to")} ${item.clientLimit}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {product.faq.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-[19px]">{d.learn.faq}</h2>
              <Accordion>
                {product.faq.map((entry) => (
                  <AccordionItem key={entry.q} name="buy-product-faq" title={entry.q}>
                    {entry.a}
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutForm
            locale={locale}
            d={d}
            tiers={tiers}
            defaultTier={license && tiers.some((tier) => tier.id === license) ? license : tiers[0]?.id}
            providers={product.available ? status.providers : []}
            prelaunch={status.prelaunch || !product.available}
            signedIn={Boolean(user)}
            successHref={path("/app/library", locale)}
            providerLabels={providerLabels}
          />

          <ul className="mt-4 flex flex-col gap-2 px-1">
            <li className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <Zap className="h-3.5 w-3.5 text-accent" aria-hidden />
              {d.store.instantAccess}
            </li>
            <li className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
              {d.store.commercialLicense}
            </li>
          </ul>

          {legalIsDraft && (
            <Note tone="warning" className="mt-4">
              {pick(
                locale,
                "Реквизиты продавца ещё заполняются. До завершения оформления боевые платежи отключены.",
                "The seller's legal details are still being filled in. Live payments stay disabled until they are complete.",
              )}
            </Note>
          )}
        </aside>
      </div>
    </Container>
  );
}
