import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Lock, Play } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { courseCover } from "@/content/covers";
import { ArtParallax } from "@/components/catalog/art-parallax";
import { pick } from "@/content/locale";
import type { Course } from "@/lib/api/catalog";
import { formatPrice, lessonCount, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function Difficulty({ level, label }: { level: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span className="sr-only">{label}</span>
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          aria-hidden
          className={cn("h-1 w-3 rounded-full", step <= level ? "bg-accent" : "bg-line-2")}
        />
      ))}
    </span>
  );
}

function Price({ course, locale, d }: { course: Course; locale: Locale; d: Dictionary }) {
  if (course.isFree) {
    return <span className="font-mono text-[13px] tracking-wide text-success">{d.common.free}</span>;
  }
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-mono text-[17px] leading-none font-medium tabular-nums text-ink">
        <span className="text-[12px] font-normal text-muted">{pick(locale, "от ", "from ")}</span>
        {formatPrice(course.priceEur, locale)}
      </span>
      {course.oldPriceEur && (
        <span className="font-mono text-[12px] text-faint line-through tabular-nums">
          {formatPrice(course.oldPriceEur, locale)}
        </span>
      )}
    </span>
  );
}

export function CourseCard({
  course,
  locale,
  d,
  priority,
}: {
  course: Course;
  locale: Locale;
  d: Dictionary;
  priority?: boolean;
}) {
  const image = courseCover(course.image, course.slug);
  const soon = course.status === "in-development";
  const href = path(`/learn/${course.slug}`, locale);

  if (image) return <ArtCourseCard course={course} locale={locale} d={d} priority={priority} image={image} />;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs",
        "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)]",
        "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md",
      )}
    >
      {/* The artwork is a finished card — logo, badge, title, lesson count — so it is shown whole. */}
      <div className={cn("relative overflow-hidden bg-surface-3", image ? "aspect-[3/2]" : "aspect-[21/9] border-b border-line")}>
        {image ? (
          <>
            <ArtParallax>
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                priority={priority}
                className={cn("object-cover", soon && "opacity-60 saturate-50")}
              />
            </ArtParallax>
            {/* No hard line under the art: in the dark theme its dark bottom edge melts into the card.
                On a light card a fade would only leave a pale strip, so there the art simply ends. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%] bg-gradient-to-b from-transparent to-surface light:hidden" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,var(--accent-soft),transparent_60%)]" />
        )}

        {image ? (
          // The artwork carries its own badge; a course still being recorded covers it with "soon".
          soon && (
            <div className="absolute top-[5%] right-[4%]">
              <Badge tone="warning" className="shadow-md">
                {d.badges.soon}
              </Badge>
            </div>
          )
        ) : (
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <Badge className="border border-line/60 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] text-ink-2 backdrop-blur-sm">
              {course.categoryLabel}
            </Badge>
            {course.badge && !soon && <Badge tone="accent">{d.badges[course.badge]}</Badge>}
            {soon && (
              <Badge tone="outline" className="border-line/60 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] backdrop-blur-sm">
                {d.badges.soon}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-3", image ? "px-5 pt-2 pb-5" : "p-5")}>
        <div className="flex items-center gap-3 text-[12.5px] text-muted">
          {/* the art already states the lesson count */}
          {!image && (
            <>
              <span className="tabular-nums">{lessonCount(course.lessonCount, locale, d)}</span>
              <span className="h-3 w-px bg-line-2" aria-hidden />
            </>
          )}
          <Difficulty level={course.difficulty} label={course.difficultyLabel} />
          {course.isProOnly && (
            <>
              <span className="h-3 w-px bg-line-2" aria-hidden />
              <span className="inline-flex items-center gap-1 font-mono text-2xs tracking-[0.1em] text-accent-ink">
                <Lock className="h-3 w-3" aria-hidden />
                PRO
              </span>
            </>
          )}
        </div>

        {/* the title and pitch are already on the artwork; screen readers still get them */}
        {image ? (
          /* The title is drawn on the art. A screen-reader-only heading cannot
             carry the card-wide link (its overlay is clipped with it), so the
             link covers the card on its own. */
          <>
            <h3 className="sr-only">{course.title}</h3>
            <Link href={href} aria-label={course.title} className="absolute inset-0 z-[1] rounded-xl outline-offset-4" />
          </>
        ) : (
          <h3 className="text-[19px] leading-[1.15]">
            <Link href={href} className="outline-offset-4 after:absolute after:inset-0 after:content-['']">
              {course.title}
            </Link>
          </h3>
        )}

        <p className={cn("line-clamp-2 text-[13.5px] leading-relaxed text-ink-3", image && "sr-only")}>
          {course.description || course.summary}
        </p>

        {/* Sits above the card-wide link so it can lead straight into the demo lesson. */}
        {!course.isFree && !soon && (
          <Link
            href={path(`/study/${course.slug}/1`, locale)}
            className="relative z-10 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {pick(locale, "Смотреть бесплатный урок", "Watch the free lesson")}
          </Link>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pt-3">
          <Price course={course} locale={locale} d={d} />
          {image && !soon && (
            /* Above the card-wide link, so it leads straight to checkout (or into a free course). */
            <Link
              href={course.isFree ? href : path(`/learn/${course.slug}/buy`, locale)}
              className="relative z-10 inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent shadow-[0_8px_22px_-8px_color-mix(in_oklab,var(--accent)_75%,transparent)] transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-accent-strong"
            >
              {course.isFree ? pick(locale, "Начать", "Start") : pick(locale, "Купить", "Buy")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
          {!image && (
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-3 transition-[background-color,color,transform] duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent"
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* Dark ground the art fades into; the card keeps it in either theme. */
const ART_INK = "#0c0c0e";

/**
 * A course with finished artwork. The art's own title block (its lower third)
 * is cropped away: the card shows the picture, then the text in bold under
 * it, on a black fade that carries the picture into the card.
 */
function ArtCourseCard({
  course,
  locale,
  d,
  priority,
  image,
}: {
  course: Course;
  locale: Locale;
  d: Dictionary;
  priority?: boolean;
  image: string;
}) {
  const soon = course.status === "in-development";
  const href = path(`/learn/${course.slug}`, locale);
  const chips = [
    lessonCount(course.lessonCount, locale, d),
    course.difficultyLabel,
    course.isProOnly ? "PRO" : null,
  ].filter(Boolean) as string[];

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/10 text-white shadow-md",
        "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)]",
        "hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg focus-within:-translate-y-0.5",
      )}
      style={{ background: ART_INK }}
    >
      <div className="relative aspect-[21/10] overflow-hidden">
        <ArtParallax>
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
            priority={priority}
            className={cn("object-cover object-top", soon && "opacity-60 saturate-50")}
          />
        </ArtParallax>
        {/* the black fade the text block rises out of */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
          style={{ background: `linear-gradient(to bottom, transparent, color-mix(in oklab, ${ART_INK} 70%, transparent) 55%, ${ART_INK})` }}
        />
        {soon && (
          <div className="absolute top-[7%] right-[4%]">
            <Badge tone="warning" className="shadow-md">
              {d.badges.soon}
            </Badge>
          </div>
        )}
      </div>

      <div className="relative -mt-14 flex flex-1 flex-col gap-3 px-5 pb-5">
        <h3 className="font-display text-[22px] leading-[1.08] font-extrabold tracking-[-0.025em] text-white">
          <Link href={href} className="outline-offset-4 after:absolute after:inset-0 after:z-[1] after:content-['']">
            {course.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-white/75">{course.description || course.summary}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold",
                chip === "PRO" ? "border-accent/50 text-accent" : "border-white/15 bg-white/5 text-white/85",
              )}
            >
              {chip === "PRO" && <Lock className="h-3 w-3" aria-hidden />}
              {chip}
            </span>
          ))}
          <span className="ml-1">
            <Difficulty level={course.difficulty} label={course.difficultyLabel} />
          </span>
        </div>

        {/* Sits above the card-wide link so it can lead straight into the demo lesson. */}
        {!course.isFree && !soon && (
          <Link
            href={path(`/study/${course.slug}/1`, locale)}
            className="relative z-10 inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-accent underline-offset-4 hover:underline"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {pick(locale, "Смотреть бесплатный урок", "Watch the free lesson")}
          </Link>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-4">
          {course.isFree ? (
            <span className="font-mono text-[14px] font-semibold tracking-wide text-emerald-400">{d.common.free}</span>
          ) : (
            <span className="font-mono text-[19px] leading-none font-bold tabular-nums text-white">
              <span className="text-[12px] font-normal text-white/55">{pick(locale, "от ", "from ")}</span>
              {formatPrice(course.priceEur, locale)}
            </span>
          )}
          {soon ? (
            <span className="text-[13px] font-semibold text-white/60">{d.badges.soon}</span>
          ) : (
            /* Above the card-wide link, so it leads straight to checkout (or into a free course). */
            <Link
              href={course.isFree ? href : path(`/learn/${course.slug}/buy`, locale)}
              className="relative z-10 inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[14px] font-bold text-on-accent shadow-[0_8px_22px_-8px_color-mix(in_oklab,var(--accent)_75%,transparent)] transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-accent-strong"
            >
              {course.isFree ? pick(locale, "Начать", "Start") : pick(locale, "Купить", "Buy")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Dense row used in rails and in "also in this bundle" lists. */
export function CourseRow({ course, locale, d }: { course: Course; locale: Locale; d: Dictionary }) {
  const image = courseCover(course.image, course.slug);
  return (
    <Link
      href={path(`/learn/${course.slug}`, locale)}
      className="group flex items-center gap-3.5 rounded-lg border border-line bg-surface p-2.5 pr-4 transition-colors hover:border-line-2 hover:bg-surface-2"
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-line bg-surface-3">
        {image && <Image src={image} alt="" fill sizes="48px" className="object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{course.title}</span>
        <span className="block text-[12.5px] text-muted">
          {course.categoryLabel} · {lessonCount(course.lessonCount, locale, d)}
        </span>
      </span>
      <span className="font-mono text-[13px] tabular-nums text-ink-2">
        {course.isFree ? d.common.free : `${pick(locale, "от", "from")} ${formatPrice(course.priceEur, locale)}`}
      </span>
    </Link>
  );
}
