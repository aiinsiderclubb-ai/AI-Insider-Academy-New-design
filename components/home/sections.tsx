import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Badge, Dot } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { AnimatedNumber, Rating } from "@/components/primitives/display";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { Magnetic, Spotlight } from "@/components/motion/pointer";
import { learningStages } from "@/content/catalog";
import { pick } from "@/content/locale";
import type { Course } from "@/lib/api/catalog";
import type { Review } from "@/lib/api/public";
import { formatPrice, path, plural, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ============================== four entrances ============================= */

export function Entrances({ locale, d }: { locale: Locale; d: Dictionary }) {
  const items = [
    { title: d.nav.learn, note: d.home.coursesBody, href: path("/learn", locale) },
    { title: d.nav.store, note: d.home.storeBody, href: path("/store", locale) },
    { title: d.nav.plans, note: d.plans.body, href: path("/plans", locale) },
    { title: d.nav.community, note: d.community.forumBody, href: path("/community/forum", locale) },
  ];

  return (
    <Container size="wide" className="py-20 sm:py-28">
      <Reveal>
        <SectionHead eyebrow={d.nav.learn} title={d.home.hubsTitle} body={d.home.hubsBody} />
      </Reveal>

      <RevealGroup
        step={70}
        className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-2 lg:grid-cols-4"
      >
        {items.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex h-full min-h-48 flex-col justify-between gap-8 p-6 transition-colors hover:bg-surface-2",
              "border-line",
              index > 0 && "border-t sm:border-t-0",
              index % 2 === 1 && "sm:border-l",
              "lg:border-l lg:first:border-l-0",
              (index === 2 || index === 3) && "sm:border-t lg:border-t-0",
            )}
          >
            <span className="font-mono text-[12px] tracking-[0.14em] text-accent">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <span className="block text-[20px] leading-tight font-extrabold tracking-tight text-ink">
                {item.title}
              </span>
              <span className="mt-2.5 line-clamp-3 block text-[13.5px] leading-relaxed text-ink-3">{item.note}</span>
            </span>
            <ArrowUpRight
              className="h-5 w-5 text-line-3 transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
              aria-hidden
            />
          </Link>
        ))}
      </RevealGroup>
    </Container>
  );
}

/* ================================== access ================================= */

export interface AccessOption {
  kicker: string;
  title: string;
  price: string;
  priceNote: string;
  points: string[];
  footnote: string;
  href: string;
  cta: string;
  featured?: boolean;
}

export function Access({ d, options }: { d: Dictionary; options: AccessOption[] }) {
  return (
    <section className="chapter ch-tint">
      <Container size="wide">
          <Reveal>
            <SectionHead eyebrow={d.home.plansTitle} title={d.home.plansBody} />
          </Reveal>

          <RevealGroup step={80} className="grid gap-4 lg:grid-cols-3">
            {options.map((option) => (
              <div
                key={option.title}
                className={cn(
                  "flex h-full flex-col rounded-2xl border bg-surface p-7 shadow-xs transition-[transform,box-shadow] duration-300 hover:-translate-y-1",
                  option.featured ? "border-accent/45 shadow-glow" : "border-line hover:shadow-md",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow">{option.kicker}</span>
                  {option.featured && <Badge tone="accent">{d.plans.mostPopular}</Badge>}
                </div>

                <h3 className="mt-4 text-[21px] leading-tight">{option.title}</h3>

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-none font-extrabold tracking-tight tabular-nums">
                    {option.price}
                  </span>
                  <span className="text-[13px] text-muted">{option.priceNote}</span>
                </p>

                <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5">
                  {option.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-[12.5px] leading-relaxed text-muted">{option.footnote}</p>

                <ButtonLink
                  href={option.href}
                  variant={option.featured ? "primary" : "secondary"}
                  className="mt-auto pt-0"
                  full
                >
                  {option.cta}
                </ButtonLink>
              </div>
            ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

/* =================================== path ================================== */

export function LearningPath({ locale, d, courses }: { locale: Locale; d: Dictionary; courses: Course[] }) {
  return (
    <Spotlight as="section" className="chapter ch-ink relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(48rem 30rem at 92% 0%, color-mix(in oklab, #ff7a1a 12%, transparent), transparent 64%)",
        }}
      />
      <Container size="wide" className="relative">
        <Reveal>
          <SectionHead
            eyebrow={d.nav.path}
            title={d.learn.subtitle}
            body={pick(
              locale,
              "Три этапа: бесплатное знакомство, отборочная программа и профессиональные треки.",
              "Three stages: a free introduction, an intake programme and the professional tracks.",
            )}
            action={
              <ButtonLink href={path("/learn/path", locale)} variant="ghost" size="sm">
                {d.common.showAll}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            }
          />
        </Reveal>

        <RevealGroup step={90} as="ol" itemAs="li" className="grid gap-4 md:grid-cols-3">
          {learningStages.map((stage) => {
            const stageCourses = courses.filter((course) => stage.courseIds.includes(course.id));
            return (
              <div
                key={stage.id}
                className="relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[12px] tracking-[0.14em] text-accent">
                    {String(stage.order).padStart(2, "0")}
                  </span>
                  <span className="h-px flex-1 bg-line" aria-hidden />
                </div>

                <h3 className="mt-4 text-[18px] leading-tight">{pick(locale, stage.title, stage.titleEn)}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {pick(locale, stage.subtitle, stage.subtitleEn)}
                </p>

                <ul className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4">
                  {stageCourses.map((course) => (
                    <li key={course.id}>
                      <Link
                        href={path(`/learn/${course.slug}`, locale)}
                        className="flex items-center justify-between gap-3 rounded-md py-1.5 text-[13.5px] text-ink-2 transition-colors hover:text-accent-ink"
                      >
                        <span className="truncate">{course.title}</span>
                        <span className="shrink-0 font-mono text-[12px] tabular-nums text-faint">
                          {course.isFree ? d.common.free : formatPrice(course.priceEur, locale)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </RevealGroup>
      </Container>
    </Spotlight>
  );
}

/* ================================= reviews ================================= */

export function Reviews({ locale, d, reviews }: { locale: Locale; d: Dictionary; reviews: Review[] }) {
  if (!reviews.length) return null;

  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  const shown = reviews.slice(0, 6);

  return (
    <section className="chapter ch-paper">
      <Container size="wide">
      <Reveal>
        <SectionHead
          eyebrow={d.home.reviewsBody}
          title={d.home.reviewsTitle}
          action={
            <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2">
              <Rating value={average} size={15} />
              <span className="text-[13px] text-muted">
                {reviews.length}{" "}
                {plural(reviews.length, locale, [d.common.results_1, d.common.results_2, d.common.results_5])}
              </span>
            </div>
          }
        />
      </Reveal>

      <RevealGroup step={70} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((review) => (
          <figure
            key={review.id}
            className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <Rating value={review.rating} size={13} />
            <blockquote className="mt-4 flex-1 text-[14.5px] leading-relaxed text-ink-2">{review.text}</blockquote>
            <figcaption className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-[13px] font-medium text-ink">{review.author}</span>
              <Link
                href={path(`/learn/${review.courseSlug}`, locale)}
                className="truncate font-mono text-2xs tracking-[0.1em] text-muted uppercase transition-colors hover:text-accent-ink"
              >
                {review.courseTitle}
              </Link>
            </figcaption>
          </figure>
        ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

/* ================================= closing ================================= */

export interface ClosingStats {
  courses: number;
  lessons: number;
  products: number;
}

/**
 * Splits a sentence once around the phrase that carries the marker.
 *
 * The highlight is a translated string rather than markup in the dictionary,
 * so a translator can move it to whichever word carries the promise in their
 * language. If the phrase is missing the sentence still renders — unmarked,
 * never broken.
 */
function splitOnMark(sentence: string, mark: string): [string, string, string] {
  const at = mark ? sentence.indexOf(mark) : -1;
  if (at < 0) return [sentence, "", ""];
  return [sentence.slice(0, at), mark, sentence.slice(at + mark.length)];
}

/**
 * The closing frame.
 *
 * The last thing on the page has to feel like the front of a building, not a
 * footer: a dark panel with its own hairline strip, the promise set large with
 * the marker on the word that carries it, the offer stated as a pass beside
 * it, and the numbers the page has been proving all the way down counted out
 * along the bottom. The photograph is pushed right back — it is the ground the
 * ember sits on, not the subject.
 */
export function Closing({
  locale,
  d,
  stats,
}: {
  locale: Locale;
  d: Dictionary;
  stats: ClosingStats;
}) {
  const [before, mark, after] = splitOnMark(d.home.ctaBody, d.home.ctaMark);

  const points = [d.home.ctaPoint1, d.home.ctaPoint2, d.home.ctaPoint3];

  const ledger = [
    { value: stats.courses, suffix: "", label: d.home.statsCourses },
    { value: stats.lessons, suffix: "+", label: d.home.statsLessons },
    { value: stats.products, suffix: "", label: d.home.statsProducts },
    { value: 3, suffix: "", label: d.home.statsLangs },
  ];

  return (
    <Container size="wide" className="pt-20 pb-24 sm:pt-28 sm:pb-32">
      <Reveal>
        <Spotlight className="on-dark relative isolate overflow-hidden rounded-3xl border border-line-2 bg-ground shadow-lg">
          {/* ------------------------------- ground ------------------------------- */}
          <Image
            src="/design/mentor-lesson-poster.webp"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1400px"
            className="object-cover opacity-30 saturate-[0.35]"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgb(10 9 8 / 0.9) 0%, rgb(10 9 8 / 0.78) 45%, rgb(10 9 8 / 0.94) 100%)",
            }}
          />
          {/* The ember. It drifts, so the panel is never quite the same twice. */}
          <div
            aria-hidden
            className="animate-drift absolute -inset-x-32 -bottom-56 h-[42rem]"
            style={{
              background:
                "radial-gradient(38rem 22rem at 22% 100%, color-mix(in oklab, #ff7a1a 34%, transparent), transparent 68%), radial-gradient(30rem 18rem at 82% 8%, color-mix(in oklab, #ff7a1a 16%, transparent), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="hairline-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]"
          />
          {/* A scan line crossing the panel — the one moving part. */}
          <span
            aria-hidden
            className="animate-sweep absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--accent)_9%,transparent),transparent)]"
          />

          {/* ------------------------------- top strip ---------------------------- */}
          <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-6 py-4 sm:px-10">
            <p className="eyebrow flex items-center gap-2.5 text-ink-2">
              <Dot pulse />
              {d.home.ctaTitle}
            </p>
            <p className="font-mono text-2xs tracking-[0.22em] text-muted uppercase">RU · UA · EN</p>
          </div>

          {/* --------------------------------- body ------------------------------- */}
          <div className="relative grid gap-12 px-6 py-14 sm:px-10 sm:py-20 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-16">
            <div>
              <h2 className="max-w-[16ch] text-[clamp(2.1rem,5.2vw,4rem)] leading-[1.06] tracking-[-0.045em] text-ink">
                {before}
                {mark && <span className="mark">{mark}</span>}
                {after}
              </h2>

              <p className="mt-8 max-w-lg text-[15.5px] leading-relaxed text-ink-2">{d.home.ctaNote}</p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <ButtonLink href={path("/register", locale)} size="lg" className="group">
                    {d.home.ctaButton}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </ButtonLink>
                </Magnetic>
                <ButtonLink
                  href={path("/plans", locale)}
                  variant="secondary"
                  size="lg"
                  className="border-line-3 bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] backdrop-blur-md"
                >
                  {d.plans.compare}
                </ButtonLink>
              </div>
            </div>

            {/* the pass — what a free account actually opens */}
            <div className="relative rounded-2xl border border-line-2 bg-[color-mix(in_oklab,var(--surface)_62%,transparent)] p-6 shadow-pop backdrop-blur-xl sm:p-7">
              <span
                aria-hidden
                className="absolute -top-px left-7 h-px w-24 bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]"
              />
              <div className="flex items-baseline justify-between gap-4">
                <p className="eyebrow text-accent-ink">{d.home.ctaPanelTitle}</p>
                <span className="numeral text-[13px] tabular-nums">00</span>
              </div>

              <ul className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
                {points.map((point) => (
                  <li key={point} className="flex gap-3 text-[14px] leading-snug text-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>

              <p className="mt-6 border-t border-line pt-5 text-[12.5px] leading-relaxed text-muted">
                {d.home.ctaPanelNote}
              </p>
            </div>
          </div>

          {/* -------------------------------- ledger ------------------------------ */}
          <dl className="relative grid grid-cols-2 border-t border-line sm:grid-cols-4">
            {ledger.map((figure, index) => (
              <div
                key={figure.label}
                className={cn(
                  "border-line px-6 py-6 sm:px-8",
                  index % 2 === 1 && "border-l",
                  index > 1 && "border-t sm:border-t-0",
                  "sm:border-l sm:first:border-l-0",
                )}
              >
                <dt className="sr-only">{figure.label}</dt>
                <dd>
                  <span className="block font-display text-[clamp(1.5rem,2.8vw,2.25rem)] leading-none font-extrabold tracking-tight text-ink">
                    <AnimatedNumber value={figure.value} duration={900 + index * 120} />
                    {figure.suffix}
                  </span>
                  <span className="mt-2 block text-[12.5px] leading-snug text-muted">{figure.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Spotlight>
      </Reveal>
    </Container>
  );
}
