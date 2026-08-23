import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { courseCover } from "@/content/covers";
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

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs",
        "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)]",
        "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md",
      )}
    >
      {/* cinematic band rather than a blog thumbnail */}
      <div className="relative aspect-[21/9] overflow-hidden border-b border-line bg-surface-3">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]",
              soon && "opacity-55 saturate-50",
            )}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,var(--accent-soft),transparent_60%)]" />
        )}

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
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3 text-[12.5px] text-muted">
          <span className="tabular-nums">{lessonCount(course.lessonCount, locale, d)}</span>
          <span className="h-3 w-px bg-line-2" aria-hidden />
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

        <h3 className="text-[19px] leading-[1.15]">
          <Link href={href} className="outline-offset-4 after:absolute after:inset-0 after:content-['']">
            {course.title}
          </Link>
        </h3>

        <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-3">{course.description || course.summary}</p>

        <div className="mt-auto flex items-end justify-between gap-4 pt-3">
          <Price course={course} locale={locale} d={d} />
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-3 transition-[background-color,color,transform] duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
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
        {course.isFree ? d.common.free : formatPrice(course.priceEur, locale)}
      </span>
    </Link>
  );
}
