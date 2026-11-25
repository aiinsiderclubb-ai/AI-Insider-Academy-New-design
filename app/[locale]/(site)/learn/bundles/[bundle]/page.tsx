import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Gift } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal } from "@/components/motion/reveal";
import { CourseCard } from "@/components/catalog/course-card";
import { bundleById, courseBundles } from "@/content/catalog";
import { packsPublic } from "@/lib/visibility";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCheckoutStatus, type ProviderId } from "@/lib/api/checkout";
import { getSession } from "@/lib/api/session";
import { formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";


export function generateStaticParams() {
  return courseBundles.map((bundle) => ({ bundle: bundle.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; bundle: string }>;
}): Promise<Metadata> {
  const { locale, bundle: id } = await params;
  const bundle = bundleById(id);
  if (!bundle) return {};
  return { title: bundle.title, description: pick(locale as Locale, bundle.descRu, bundle.descEn) };
}

export default async function BundlePage({
  params,
}: {
  params: Promise<{ locale: string; bundle: string }>;
}) {
  const { locale: raw, bundle: id } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const bundle = bundleById(id);
  if (!bundle || !packsPublic()) notFound();

  const [courses, status, user] = await Promise.all([getCourses(locale), getCheckoutStatus(), getSession()]);
  const included = bundle.courseIds
    .map((courseId) => courses.find((course) => course.id === courseId))
    .filter((course): course is NonNullable<typeof course> => Boolean(course));

  const separately = included.reduce((sum, course) => sum + course.priceEur, 0);
  const saving = Math.max(0, separately - bundle.priceEur);
  const bonuses = pick(locale, bundle.bonusRu, bundle.bonusEn);
  const providerLabels: Record<ProviderId, { name: string; note: string }> = {
    paddle: { name: pick(locale, "Карта, PayPal, Apple Pay", "Card, PayPal, Apple Pay"), note: pick(locale, "Оплата через Paddle — он продаёт заказ и выдаёт чек", "Paid through Paddle, which sells the order and issues the receipt") },
    gumroad: { name: pick(locale, "Карта, PayPal, Apple Pay", "Card, PayPal, Apple Pay"), note: pick(locale, "Оплата на Gumroad — он продаёт заказ и выдаёт чек; доступ откроется в кабинете", "Paid on Gumroad, which sells the order and issues the receipt; access opens in your cabinet") },
    stripe: { name: "Stripe", note: "Visa · Mastercard" },
    liqpay: { name: "LiqPay", note: pick(locale, "Украина", "Ukraine") },
    tribute: { name: "Tribute", note: pick(locale, "Карта, СБП, Stars, TON", "Card, SBP, Stars, TON") },
    demo: { name: "Demo", note: pick(locale, "Тестовая оплата", "Test payment") },
  };
  const lessons = included.reduce((sum, course) => sum + course.lessonCount, 0);
  /* A pack goes on sale once every course in it is recorded. */
  const soon = included.some((course) => course.status === "in-development");

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.learn.title, href: path("/learn", locale) },
            { label: d.nav.bundles, href: path("/learn?tab=bundles", locale) },
            { label: bundle.title },
          ]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-14">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <Badge tone="accent">{d.nav.bundles}</Badge>
            <h1 className="mt-5 text-[clamp(2.1rem,4.8vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">{bundle.title}</h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">
              {pick(locale, bundle.descRu, bundle.descEn)}
            </p>

            <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
              <div className="bg-surface p-4">
                <dt className="eyebrow">{d.nav.catalog}</dt>
                <dd className="mt-2 text-[15px] font-medium text-ink tabular-nums">{included.length}</dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="eyebrow">{d.home.statsLessons}</dt>
                <dd className="mt-2 text-[15px] font-medium text-ink tabular-nums">{lessons}</dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="eyebrow">{d.learn.savings}</dt>
                <dd className="mt-2 text-[15px] font-medium text-success tabular-nums">{formatPrice(saving, locale)}</dd>
              </div>
            </dl>

            {bonuses.length > 0 && (
              <section className="mt-8 rounded-lg border border-accent/35 bg-accent-soft p-6">
                <h2 className="flex items-center gap-2 text-[17px]">
                  <Gift className="h-4 w-4 text-accent-ink" aria-hidden />
                  {d.learn.bonuses}
                </h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {bonuses.map((bonus) => (
                    <li key={bonus} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      {bonus}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
                  {pick(
                    locale,
                    "Бонусы появятся в Библиотеке кабинета сразу после оплаты — вместе с курсами пакета.",
                    "The bonuses appear in your Library right after payment, together with the bundle's courses.",
                  )}
                </p>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
              <p className="eyebrow">{d.checkout.total}</p>
              <p className="mt-3 flex items-baseline gap-2.5">
                <span className="font-display text-[2.5rem] leading-none font-extrabold tracking-tight tabular-nums">
                  {formatPrice(bundle.priceEur, locale)}
                </span>
                <span className="font-mono text-[14px] text-faint line-through tabular-nums">
                  {formatPrice(bundle.oldPriceEur, locale)}
                </span>
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted">{d.common.forever}</p>

              <ul className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
                {included.map((course) => (
                  <li key={course.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="min-w-0 truncate text-ink-2">{course.title}</span>
                    <span className="shrink-0 font-mono text-[12px] text-faint tabular-nums">
                      {formatPrice(course.priceEur, locale)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-center text-[12px] text-muted">{d.checkout.instantAccess}</p>
            </div>

            {/* The pack itself is the item: paying opens its courses and hands over its bonuses. */}
            {soon ? (
              <div className="mt-4 rounded-lg border border-line bg-surface p-5 shadow-sm">
                <Badge tone="warning">{d.badges.soon}</Badge>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
                  {pick(
                    locale,
                    "Курсы этого пакета сейчас записываются. Пакет откроется для покупки, как только выйдут все видео.",
                    "The courses in this bundle are being recorded. It goes on sale once every video is out.",
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <CheckoutForm
                  locale={locale}
                  d={d}
                  tiers={[{ id: "pack", label: bundle.title, priceEur: bundle.priceEur, itemId: bundle.id }]}
                  providers={status.providers}
                  prelaunch={status.prelaunch}
                  signedIn={Boolean(user)}
                  successHref={path("/app/learning", locale)}
                  providerLabels={providerLabels}
                  email={user?.email}
                />
              </div>
            )}
          </aside>
        </div>
      </Container>

      <Container size="wide" className="pb-20">
        <Reveal>
          <SectionHead eyebrow={d.nav.bundles} title={pick(locale, "Что входит в пакет", "What is in the bundle")} as="h2" />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {included.map((course) => (
            <CourseCard key={course.id} course={course} locale={locale} d={d} />
          ))}
        </div>
      </Container>
    </>
  );
}
