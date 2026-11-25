import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { CheckoutForm, type CheckoutTier } from "@/components/checkout/checkout-form";
import { courseCover, courseTrailer } from "@/content/covers";
import { CourseTrailer } from "@/components/catalog/course-trailer";
import { pick } from "@/content/locale";
import { legalIsDraft } from "@/content/site";
import { getCourse } from "@/lib/api/catalog";
import { getCheckoutStatus, type ProviderId } from "@/lib/api/checkout";
import { getAccess, getSession, hasReview, onSelfPlan } from "@/lib/api/session";
import { getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";

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
  // A course still being recorded is not on sale; its page offers a launch notice instead.
  if (course.status === "in-development") redirect(path(`/learn/${course.slug}`, locale));

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
  const trailer = courseTrailer(course.slug);
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

      {/*
        On a phone the order panel comes right after the trailer, before the
        details; on a wide screen it holds the right column beside both.
      */}
      <div className="mt-7 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr]">
        {/* ------------------------------ left column ----------------------------- */}
        <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">
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

          {/* The trailer, when the course has one — a buyer sees the course moving, not a still. */}
          {trailer ? (
            <div className="mt-7">
              <CourseTrailer
                src={trailer}
                poster={image ?? null}
                label={pick(locale, "Трейлер курса", "Course trailer")}
                soonLabel={pick(locale, "Трейлер скоро", "Trailer coming")}
                playLabel={pick(locale, "Смотреть трейлер", "Play the trailer")}
                facts={[]}
              />
            </div>
          ) : (
            image && (
              <div className="relative mt-7 aspect-[21/9] overflow-hidden rounded-lg border border-line bg-surface-3">
                <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
              </div>
            )
          )}

        </div>

        <div className="order-3 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
          <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
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

        </div>

        {/* ------------------------------ order panel ----------------------------- */}
        <aside className="order-2 lg:sticky lg:top-24 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
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

          {/* Questions live on the course page, so checkout stays about paying. */}
          <Link
            href={`${path(`/learn/${course.slug}`, locale)}#faq`}
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-[13px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            {pick(locale, "Вопросы о доступе, возврате и сертификате", "Questions on access, refunds and certificates")}
            <span aria-hidden>→</span>
          </Link>

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
