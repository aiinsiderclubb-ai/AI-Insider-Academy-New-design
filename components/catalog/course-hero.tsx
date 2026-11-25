import Link from "next/link";
import { ArrowRight, Flame, ListVideo, Play } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { Rating } from "@/components/primitives/display";
import { Headline } from "@/components/motion/headline";
import { Magnetic } from "@/components/motion/pointer";
import { Reveal } from "@/components/motion/reveal";
import { CourseTrailer } from "@/components/catalog/course-trailer";
import { Countdown } from "@/components/motion/countdown";
import { groupLessons } from "@/content/catalog";
import type { DemoState } from "@/lib/api/session";
import { courseTrailer } from "@/content/covers";
import { pick } from "@/content/locale";
import type { Course } from "@/lib/api/catalog";
import { formatPrice, path, plural, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The course opener.
 *
 * Editorial rather than cinematic — the home page already owns the full-bleed
 * photograph, so a course states its name on a dark ground and lets its
 * trailer arrive underneath, crossing into the next chapter. Everything a
 * buyer needs to decide sits above that crossing: what it is, what it costs,
 * one action. The numbers that used to occupy a ledger of their own now ride
 * on the trailer's bottom edge, where they read as a caption.
 */
/** The moment of this render, for the countdown's first paint. */
function renderedAt() {
  return Date.now();
}

/** Hours left until a moment, rounded up — for the launch offer's countdown. */
function hoursUntil(endsAt: string) {
  return Math.max(1, Math.ceil((Date.parse(endsAt) - Date.now()) / 3_600_000));
}

export function CourseHero({
  course,
  locale,
  d,
  image,
  average,
  count,
  owned,
  demo = { kind: "none" },
}: {
  course: Course;
  locale: Locale;
  d: Dictionary;
  image?: string | null;
  average: number;
  count: number;
  owned: boolean;
  /** The learner's standing with the free first lesson; computed by the page from their access. */
  demo?: DemoState;
}) {
  const soon = course.status === "in-development";
  /* `durationLabel` already opens with the lesson count, so showing it here
     would print the same number twice. Modules say something it does not. */
  const moduleCount = groupLessons(course.lessons, course.modulePlan).length;

  const moduleForms: [string, string, string] =
    locale === "en"
      ? ["module", "modules", "modules"]
      : locale === "ukr"
        ? ["модуль", "модулі", "модулів"]
        : ["модуль", "модуля", "модулей"];

  const facts = [
    `${course.lessonCount} ${plural(course.lessonCount, locale, [d.common.lessons_1, d.common.lessons_2, d.common.lessons_5])}`,
    `${moduleCount} ${plural(moduleCount, locale, moduleForms)}`,
    course.difficultyLabel,
    course.hasHomework ? pick(locale, "с проверкой", "reviewed") : pick(locale, "самостоятельно", "self-paced"),
  ];

  const trailer = courseTrailer(course.slug);

  /* A paid course on sale offers its two plans right here, each with its price and its own way to checkout. */
  const sellsPlans = !owned && !course.isFree && !soon && !course.isIntake;
  const plans = [
    {
      id: "self",
      label: pick(locale, "Самостоятельно", "On your own"),
      note: pick(locale, "Все уроки и материалы, самопроверка", "Every lesson and resource, self-check"),
      price: course.priceEur,
      href: path(`/learn/${course.slug}/buy?tier=self`, locale),
      featured: false,
    },
    {
      id: "mentor",
      label: d.learn.withMentor,
      note: pick(locale, "Проверка заданий, ментор и сертификат", "Reviewed work, a mentor and a certificate"),
      price: course.mentorPriceEur,
      href: path(`/learn/${course.slug}/buy?tier=mentor`, locale),
      featured: true,
    },
  ];
  /* The launch offer: the mentor plan at the self-study price, for a few days. */
  const offerHours = course.mentorOfferEndsAt ? hoursUntil(course.mentorOfferEndsAt) : null;

  return (
    <section data-dark-hero className="ch-ink relative isolate z-10 -mt-16 overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52rem 34rem at 88% 6%, color-mix(in oklab, #ff7a1a 15%, transparent), transparent 64%)",
        }}
      />
      <div aria-hidden className="hairline-grid pointer-events-none absolute inset-0 opacity-[0.35]" />

      <Container size="wide" className="relative pt-24 sm:pt-28">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.learn.title, href: path("/learn", locale) },
            { label: course.categoryLabel, href: path(`/learn?track=${encodeURIComponent(course.categoryLabel)}`, locale) },
            { label: course.title },
          ]}
        />

        <div className="mt-10 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <Reveal>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="outline">{course.categoryLabel}</Badge>
                {course.isProOnly && <Badge tone="accent">{d.badges.pro}</Badge>}
                {course.badge && <Badge tone="accent">{d.badges[course.badge]}</Badge>}
                {soon && <Badge tone="warning">{d.badges.soon}</Badge>}
              </div>
            </Reveal>

            <Headline
              as="h1"
              text={course.title}
              delay={120}
              step={70}
              className="mt-6 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.045em] text-ink"
            />

            <Reveal delay={260}>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">{course.idea || course.description}</p>
            </Reveal>

            {count > 0 && (
              <Reveal delay={320}>
                <div className="mt-6 flex items-center gap-3">
                  <Rating value={average} count={count} size={15} />
                  <Link href="#reviews" className="text-[13px] text-muted underline-offset-4 hover:text-ink">
                    {d.learn.reviews}
                  </Link>
                </div>
              </Reveal>
            )}
          </div>

          {/* --------------------------- price and action -------------------------- */}
          <Reveal delay={200} className="lg:pb-2">
            <div className="flex flex-col gap-4 lg:items-end lg:text-right">
              {sellsPlans ? (
                <div className="w-full lg:w-[22rem]">
                  {offerHours && course.mentorOfferEndsAt ? (
                    <div className="relative mb-4 overflow-hidden rounded-xl border border-accent/50 p-4 text-left shadow-glow" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 30%, transparent), color-mix(in oklab, var(--accent) 8%, transparent))" }}>
                      <p className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-accent-ink uppercase">
                        <Flame className="h-3.5 w-3.5" aria-hidden />
                        {pick(locale, "Цена запуска", "Launch price")}
                      </p>
                      <p className="mt-2 text-[15px] leading-snug font-semibold text-ink">
                        {pick(locale, "Ментор и проверка заданий — без доплаты", "Mentor and reviewed work — no extra charge")}
                      </p>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-2">
                        {pick(
                          locale,
                          `Первые 72 часа после запуска тариф с ментором стоит как самостоятельный: ${formatPrice(course.mentorPriceEur, locale)} вместо ${formatPrice(course.mentorListEur ?? course.mentorPriceEur, locale)}. Потом — обычная цена.`,
                          `For the first 72 hours after launch the mentor plan costs the same as self-study: ${formatPrice(course.mentorPriceEur, locale)} instead of ${formatPrice(course.mentorListEur ?? course.mentorPriceEur, locale)}. Then the usual price.`,
                        )}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-accent/25 pt-3">
                        <span className="text-[12px] text-muted">{pick(locale, "До конца осталось", "Ends in")}</span>
                        <Countdown
                          endsAt={course.mentorOfferEndsAt}
                          serverNow={renderedAt()}
                          className="text-ink"
                          labels={locale === "en" ? ["h", "min", "sec"] : ["ч", "мин", "сек"]}
                        />
                      </div>
                    </div>
                  ) : null}
                  <p className="eyebrow">{d.learn.priceYours}</p>
                  <div className="mt-3 flex flex-col gap-2.5 text-left">
                    {plans.map((plan) => (
                      <Link
                        key={plan.id}
                        href={plan.href}
                        className={cn(
                          "group flex items-center justify-between gap-4 rounded-xl border p-4 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px",
                          plan.featured
                            ? "border-accent bg-accent-soft hover:bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]"
                            : "border-line bg-surface hover:border-line-2 hover:bg-surface-2",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
                            {plan.label}
                            {plan.featured && (
                              <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] tracking-wide text-on-accent uppercase">
                                {pick(locale, "с проверкой", "reviewed")}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{plan.note}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="flex flex-col items-end">
                            {plan.featured && offerHours && course.mentorListEur ? (
                              <span className="font-mono text-[11.5px] leading-none text-faint line-through tabular-nums">
                                {formatPrice(course.mentorListEur, locale)}
                              </span>
                            ) : null}
                            <span className="font-display text-[22px] leading-none font-extrabold tabular-nums text-ink">
                              {formatPrice(plan.price, locale)}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5",
                              plan.featured ? "bg-accent text-on-accent" : "border border-line text-ink-2 group-hover:border-accent group-hover:text-accent",
                            )}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>

                  <p className="mt-2.5 text-[12.5px] text-muted lg:text-right">
                    {pick(locale, "Разовая оплата · доступ навсегда · можно доплатить до ментора позже", "One payment · yours for good · upgrade to a mentor any time")}
                  </p>
                </div>
              ) : (
              <>
              <div>
                <p className="eyebrow">{owned ? pick(locale, "Ваш курс", "Yours") : d.learn.priceYours}</p>
                <p className="mt-3 flex items-baseline gap-3 lg:justify-end">
                  <span className="font-display text-[clamp(2.25rem,4vw,3.25rem)] leading-none font-extrabold tracking-tight tabular-nums text-ink">
                    {owned ? "—" : course.isFree ? d.common.free : formatPrice(course.priceEur, locale)}
                  </span>
                  {!owned && !course.isFree && (
                    <span className="font-mono text-[13px] text-muted tabular-nums">
                      {pick(locale, `с ментором ${formatPrice(course.mentorPriceEur, locale)}`, `with a mentor ${formatPrice(course.mentorPriceEur, locale)}`)}
                    </span>
                  )}
                  {!owned && course.oldPriceEur && (
                    <span className="font-mono text-[15px] text-faint line-through tabular-nums">
                      {formatPrice(course.oldPriceEur, locale)}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-[12.5px] text-muted">
                  {owned
                    ? pick(locale, "Доступ открыт", "Access is open")
                    : course.isIntake
                      ? pick(locale, "по заявке", "by application")
                      : course.isFree
                        ? pick(locale, "после регистрации", "after signing up")
                        : d.common.forever}
                </p>
              </div>

              <Magnetic>
                <ButtonLink
                  href={
                    owned
                      ? path(`/study/${course.slug}/1`, locale)
                      : course.isIntake
                        ? path(`/learn/${course.slug}/apply`, locale)
                        : course.isFree
                          ? path(`/register?next=/learn/${course.slug}`, locale)
                          : soon
                            ? "#access"
                            : path(`/learn/${course.slug}/buy`, locale)
                  }
                  size="lg"
                  className="group"
                >
                  {owned
                    ? d.common.continue
                    : course.isIntake
                      ? d.learn.apply
                      : course.isFree
                        ? d.learn.startFree
                        : soon
                          ? d.study.notifyMe
                          : d.learn.buyCourse}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </ButtonLink>
              </Magnetic>
              </>
              )}

              {course.isIntake && !owned && (
                <p className="max-w-[17rem] text-[12.5px] leading-snug text-muted">
                  {pick(locale, "Первый урок открыт всем — посмотрите до заявки.", "The first lesson is open to everyone — watch it before you apply.")}
                </p>
              )}

              {!owned && !course.isFree && !soon && demo.kind !== "none" && (
                demo.kind === "expired" ? (
                  <p className="max-w-[17rem] text-[12.5px] leading-snug text-muted">
                    {pick(locale, "Бесплатный урок вы уже посмотрели — дальше в полном курсе.", "You have already had the free lesson — the rest is in the full course.")}
                  </p>
                ) : (
                  <Link
                    href={path(`/study/${course.slug}/1`, locale)}
                    className="inline-flex items-center gap-2 text-[13.5px] font-medium text-ink transition-colors hover:text-accent"
                  >
                    <Play className="h-4 w-4 text-accent" aria-hidden />
                    {demo.kind === "active"
                      ? pick(locale, `Бесплатный урок — открыт ещё ${demo.hoursLeft} ч`, `Free lesson — open ${demo.hoursLeft} more h`)
                      : pick(locale, "Смотреть бесплатный урок", "Watch the free lesson")}
                  </Link>
                )
              )}

              <Link
                href="#curriculum"
                className="inline-flex items-center gap-2 text-[13.5px] text-ink-3 transition-colors hover:text-ink"
              >
                <ListVideo className="h-4 w-4 text-accent" aria-hidden />
                {pick(locale, "Смотреть программу", "See the syllabus")}
              </Link>
            </div>
          </Reveal>
        </div>

      </Container>

      {/* -------------------------- the trailer, crossing ------------------------- */}
      {(trailer || image) && (
        <Container size="wide" className="relative z-10 mt-14 -mb-20 sm:-mb-28">
          <div className="mx-auto max-w-5xl">
            <CourseTrailer
              src={trailer}
              poster={image ?? null}
              label={pick(locale, "Трейлер курса", "Course trailer")}
              soonLabel={pick(locale, "Трейлер скоро", "Trailer coming")}
              playLabel={pick(locale, "Смотреть трейлер", "Play the trailer")}
              facts={facts}
              artwork
            />
          </div>
        </Container>
      )}
    </section>
  );
}
