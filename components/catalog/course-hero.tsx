import Link from "next/link";
import { ArrowRight, ListVideo } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { Rating } from "@/components/primitives/display";
import { Headline } from "@/components/motion/headline";
import { Magnetic } from "@/components/motion/pointer";
import { Reveal } from "@/components/motion/reveal";
import { CourseTrailer } from "@/components/catalog/course-trailer";
import { toModules } from "@/content/catalog";
import { courseTrailer } from "@/content/covers";
import { pick } from "@/content/locale";
import type { Course } from "@/lib/api/catalog";
import { formatPrice, path, plural, type Dictionary, type Locale } from "@/lib/i18n";

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
export function CourseHero({
  course,
  locale,
  d,
  image,
  average,
  count,
  owned,
}: {
  course: Course;
  locale: Locale;
  d: Dictionary;
  image?: string | null;
  average: number;
  count: number;
  owned: boolean;
}) {
  const soon = course.status === "in-development";
  /* `durationLabel` already opens with the lesson count, so showing it here
     would print the same number twice. Modules say something it does not. */
  const moduleCount = toModules(course.lessons).length;

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

  return (
    <section data-dark-hero className="ch-ink relative isolate -mt-16 overflow-hidden">
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
              <div>
                <p className="eyebrow">{owned ? pick(locale, "Ваш курс", "Yours") : d.learn.priceYours}</p>
                <p className="mt-3 flex items-baseline gap-3 lg:justify-end">
                  <span className="font-display text-[clamp(2.25rem,4vw,3.25rem)] leading-none font-extrabold tracking-tight tabular-nums text-ink">
                    {owned ? "—" : course.isFree ? d.common.free : formatPrice(course.priceEur, locale)}
                  </span>
                  {!owned && course.oldPriceEur && (
                    <span className="font-mono text-[15px] text-faint line-through tabular-nums">
                      {formatPrice(course.oldPriceEur, locale)}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-[12.5px] text-muted">
                  {owned
                    ? pick(locale, "Доступ открыт", "Access is open")
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
                    : course.isFree
                      ? d.learn.startFree
                      : soon
                        ? d.study.notifyMe
                        : d.learn.buyCourse}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </ButtonLink>
              </Magnetic>

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
            />
          </div>
        </Container>
      )}
    </section>
  );
}
