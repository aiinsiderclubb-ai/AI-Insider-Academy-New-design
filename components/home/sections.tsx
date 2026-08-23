import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Rating } from "@/components/primitives/display";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { Spotlight } from "@/components/motion/pointer";
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

export function Closing({ locale, d }: { locale: Locale; d: Dictionary }) {
  return (
    <Container size="wide" className="pt-20 pb-24 sm:pt-28 sm:pb-32">
      <Reveal>
        <div className="on-dark relative isolate overflow-hidden rounded-3xl bg-ground">
          <Image
            src="/design/mentor-lesson-poster.webp"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1400px"
            className="object-cover saturate-[0.4] brightness-[0.55]"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgb(10 9 8 / 0.72) 0%, rgb(10 9 8 / 0.82) 100%), radial-gradient(40rem 24rem at 50% 118%, color-mix(in oklab, #ff7a1a 26%, transparent), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-2xl px-6 py-20 text-center sm:px-10 sm:py-28">
            <p className="eyebrow text-ink-3">{d.home.ctaTitle}</p>
            <h2 className="mt-6 text-[clamp(2rem,4.8vw,3.5rem)] leading-[0.98] tracking-[-0.045em] text-ink">
              {d.home.ctaBody}
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink href={path("/register", locale)} size="lg" className="group">
                {d.home.ctaButton}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </ButtonLink>
              <ButtonLink
                href={path("/plans", locale)}
                variant="secondary"
                size="lg"
                className="border-line-3 bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] backdrop-blur-md"
              >
                {d.plans.compare}
              </ButtonLink>
            </div>
            <p className="mt-7 font-mono text-2xs tracking-[0.18em] text-faint uppercase">RU · UA · EN</p>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}
