import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs, Accordion, AccordionItem } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { CheckoutForm, type CheckoutTier } from "@/components/checkout/checkout-form";
import { buyFaq, bundlesWithCourse } from "@/content/catalog";
import { courseCover } from "@/content/covers";
import { pick } from "@/content/locale";
import { legalIsDraft } from "@/content/site";
import { planByTier } from "@/content/plans";
import { getCourse } from "@/lib/api/catalog";
import { getCheckoutStatus, type ProviderId } from "@/lib/api/checkout";
import { getAccess, getSession, hasReview, onSelfPlan } from "@/lib/api/session";
import { formatPrice, getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; course: string }>;
}): Promise<Metadata> {
  const { locale, course: slug } = await params;
  const course = await getCourse(slug, locale as Locale);
  return { title: course ? `${course.title} · ${getDictionary(locale).checkout.title}` : undefined, robots: { index: false } };
}

export default async function BuyCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; course: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { locale: raw, course: slug } = await params;
  const { tier: requestedTier } = await searchParams;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const course = await getCourse(slug, locale);
  if (!course || course.isFree) notFound();

  const [status, user, access] = await Promise.all([getCheckoutStatus(), getSession(), getAccess()]);

  /*
   * Two plans. Self-study is every lesson with assignments the learner checks
   * on their own; the mentor plan adds review and a mentor. Someone who owns
   * the self-study plan is offered only the step up, at the difference — the
   * API charges the same.
   */
  const upgrading = onSelfPlan(access, course);
  const ownsAll = access.courseIds.has(course.id) && hasReview(access, course);
  const selfTier: CheckoutTier = {
    id: "self",
    plan: "self",
    label: pick(locale, "Самостоятельно", "On your own"),
    note: pick(
      locale,
      "Все уроки и материалы навсегда. Задания для самопроверки — без проверки и ментора.",
      "Every lesson and resource for good. Assignments to check yourself — no review, no mentor.",
    ),
    priceEur: course.priceEur,
    itemId: course.id,
  };
  const mentorTier: CheckoutTier = {
    id: "mentor",
    plan: "mentor",
    label: upgrading ? pick(locale, "Перейти на тариф с ментором", "Move up to the mentor plan") : d.learn.withMentor,
    note: upgrading
      ? pick(locale, "Доплата разницы: проверка домашних заданий и ментор.", "You pay the difference: assignment review and a mentor.")
      : pick(
          locale,
          "Всё из самостоятельного + проверка каждого задания, приёмка финального проекта и ментор.",
          "Everything in self-study + every assignment reviewed, the final project signed off, and a mentor.",
        ),
    priceEur: upgrading ? course.mentorPriceEur - course.priceEur : course.mentorPriceEur,
    itemId: course.id,
  };
  const tiers: CheckoutTier[] = upgrading ? [mentorTier] : [selfTier, mentorTier];

  const providerLabels: Record<ProviderId, { name: string; note: string }> = {
    paddle: { name: pick(locale, "Карта, PayPal, Apple Pay", "Card, PayPal, Apple Pay"), note: pick(locale, "Оплата через Paddle — он продаёт заказ и выдаёт чек", "Paid through Paddle, which sells the order and issues the receipt") },
    gumroad: { name: pick(locale, "Карта, PayPal, Apple Pay", "Card, PayPal, Apple Pay"), note: pick(locale, "Оплата на Gumroad — он продаёт заказ и выдаёт чек; доступ откроется в кабинете", "Paid on Gumroad, which sells the order and issues the receipt; access opens in your cabinet") },
    stripe: { name: "Stripe", note: "Visa · Mastercard" },
    liqpay: { name: "LiqPay", note: pick(locale, "Украина", "Ukraine") },
    tribute: { name: "Tribute", note: pick(locale, "Карта, СБП, Stars, TON", "Card, SBP, Stars, TON") },
    demo: { name: "Demo", note: pick(locale, "Тестовая оплата", "Test payment") },
  };

  const image = courseCover(course.image, course.slug);
  const bundles = bundlesWithCourse(course.id);
  const club = planByTier("club");
  const pro = planByTier("pro");

  const comparison = [
    {
      label: pick(locale, "Этот курс", "This course"),
      price: `${formatPrice(course.priceEur, locale)} / ${formatPrice(course.mentorPriceEur, locale)}`,
      note: d.common.forever,
      href: null,
      current: true,
    },
    ...bundles.map((bundle) => ({
      label: bundle.title,
      price: formatPrice(bundle.priceEur, locale),
      note: `${bundle.courseIds.length} ${pick(locale, "курса в пакете", "courses in the bundle")}`,
      href: path(`/learn/bundles/${bundle.id}`, locale),
      current: false,
    })),
    club && {
      label: club.name,
      price: formatPrice(club.priceEur, locale),
      note: d.common.perMonth,
      href: path("/plans", locale),
      current: false,
    },
    pro && {
      label: pro.name,
      price: formatPrice(pro.priceEur, locale),
      note: d.common.perMonth,
      href: path("/plans", locale),
      current: false,
    },
  ].filter(Boolean) as { label: string; price: string; note: string; href: string | null; current: boolean }[];

  return (
    <Container size="wide" className="pt-8 pb-20">
      <Breadcrumbs
        label={d.common.breadcrumb}
        items={[
          { label: d.learn.title, href: path("/learn", locale) },
          { label: course.title, href: path(`/learn/${course.slug}`, locale) },
          { label: d.checkout.title },
        ]}
      />

      <div className="mt-7 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------ left column ----------------------------- */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{course.categoryLabel}</Badge>
            {course.isProOnly && <Badge tone="accent">{d.badges.pro}</Badge>}
          </div>

          <h1 className="mt-4 text-[clamp(1.9rem,4.2vw,3rem)] leading-[1] tracking-[-0.04em]">{course.title}</h1>
          <p className="mt-3 text-[14px] text-muted">
            {course.durationLabel && course.durationLabel !== lessonCount(course.lessonCount, locale, d)
              ? course.durationLabel
              : lessonCount(course.lessonCount, locale, d)}
          </p>

          {image && (
            <div className="relative mt-7 aspect-[21/9] overflow-hidden rounded-lg border border-line bg-surface-3">
              <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
            </div>
          )}

          <section className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {[
              pick(locale, "Пожизненный доступ ко всем урокам", "Lifetime access to every lesson"),
              pick(locale, "Готовые шаблоны и материалы", "Templates and resources included"),
              pick(locale, "Задания к урокам и критерии самопроверки", "Lesson assignments with self-check criteria"),
              pick(locale, "С ментором: проверка заданий и ответы на вопросы", "With a mentor: assignments reviewed, questions answered"),
            ].map((item) => (
              <p key={item} className="flex items-start gap-2.5 bg-surface p-4 text-[14px] leading-snug text-ink-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                {item}
              </p>
            ))}
          </section>

          {/* ------------------------------ comparison ---------------------------- */}
          <section className="mt-10">
            <h2 className="text-[19px]">{d.checkout.comparePrices}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
              {pick(
                locale,
                "Разовая покупка, пакеты с этим курсом и подписки — одним взглядом.",
                "The one-off purchase, the bundles that include it, and the subscriptions — at a glance.",
              )}
            </p>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
              {comparison.map((option) => (
                <li
                  key={option.label}
                  className={option.current ? "bg-accent-soft p-4" : "bg-surface p-4 transition-colors hover:bg-surface-2"}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-ink">{option.label}</span>
                    {option.current && <Badge tone="accent">{d.checkout.yourChoice}</Badge>}
                  </div>
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-[18px] font-medium tabular-nums text-ink">{option.price}</span>
                    <span className="text-[12.5px] text-muted">{option.note}</span>
                  </p>
                  {option.href && (
                    <Link
                      href={option.href}
                      className="mt-2 inline-block text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
                    >
                      {d.common.more}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* --------------------------------- faq -------------------------------- */}
          <section className="mt-10">
            <h2 className="mb-5 text-[19px]">{d.learn.faq}</h2>
            <Accordion>
              {buyFaq.map((entry) => (
                <AccordionItem key={entry.q} name="buy-faq" title={pick(locale, entry.q, entry.qEn)}>
                  {pick(locale, entry.a, entry.aEn)}
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </div>

        {/* ------------------------------ order panel ----------------------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {ownsAll ? (
            <Note tone="accent">
              {pick(locale, "Этот курс у вас уже есть со всеми возможностями.", "You already have this course with everything included.")}{" "}
              <Link href={path(`/study/${course.slug}/1`, locale)} className="font-medium underline underline-offset-2">
                {d.common.continue}
              </Link>
            </Note>
          ) : (
          <CheckoutForm
            locale={locale}
            d={d}
            tiers={tiers}
            defaultTier={upgrading || requestedTier === "mentor" ? "mentor" : "self"}
            providers={status.providers}
            prelaunch={status.prelaunch}
            signedIn={Boolean(user)}
            successHref={path(`/learn/${course.slug}`, locale)}
            providerLabels={providerLabels}
            email={user?.email}
          />
          )}

          <ul className="mt-4 flex flex-col gap-2 px-1">
            <li className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <Zap className="h-3.5 w-3.5 text-accent" aria-hidden />
              {d.checkout.instantAccess}
            </li>
            <li className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
              {d.checkout.securePayment}
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
