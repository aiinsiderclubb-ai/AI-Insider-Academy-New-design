import { Lock, Play } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Reveal } from "@/components/motion/reveal";
import { ScrollRail } from "@/components/motion/rail";
import { toModules } from "@/content/catalog";
import type { Course } from "@/lib/api/catalog";
import { lessonCount, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The syllabus as a route rather than a table.
 *
 * A hairline runs down the modules and fills as the section is read, so the
 * length of the course is something you feel instead of a number you are
 * told. Modules stay `<details>` — the outline is readable and expandable
 * before any JavaScript arrives, and the browser animates the panel where it
 * can interpolate to `auto`.
 */
export function Curriculum({
  course,
  locale,
  d,
  unlockedUpTo = 0,
}: {
  course: Course;
  locale: Locale;
  d: Dictionary;
  /** Lessons below this index render as open; the rest show a lock. */
  unlockedUpTo?: number;
}) {
  const modules = toModules(course.lessons);
  if (!course.lessons.length) return null;

  return (
    <div className="relative pl-6 sm:pl-10">
      <ScrollRail className="left-0 sm:left-1" />

      <ol className="flex flex-col">
        {modules.map((lessons, moduleIndex) => (
          <Reveal as="li" key={moduleIndex} delay={Math.min(moduleIndex, 5) * 60}>
            <details
              name="curriculum"
              open={moduleIndex === 0}
              className="group border-t border-line py-1 first:border-t-0"
            >
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-baseline gap-4 sm:gap-6">
                  <span className="numeral text-[13px] tracking-[0.1em]">
                    {String(moduleIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-[clamp(1.15rem,2.1vw,1.6rem)] leading-tight font-extrabold tracking-[-0.03em] text-ink transition-colors group-hover:text-accent">
                    {d.learn.module} {moduleIndex + 1}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="font-mono text-[12px] tabular-nums text-muted">
                    {lessonCount(lessons.length, locale, d)}
                  </span>
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-[15px] text-ink-3 transition-[transform,background-color,border-color,color] duration-300 ease-[var(--ease-out-quart)] group-hover:border-accent group-hover:text-accent group-open:rotate-45 group-open:border-accent group-open:bg-accent group-open:text-on-accent"
                  >
                    +
                  </span>
                </span>
              </summary>

              <ol className="pb-4">
                {lessons.map((lesson) => {
                  const unlocked = lesson.free || lesson.index < unlockedUpTo;
                  return (
                    <li
                      key={lesson.id}
                      className="group/row flex items-start gap-4 border-t border-line/70 py-3.5 transition-colors first:border-t-0 hover:bg-[color-mix(in_oklab,var(--accent)_5%,transparent)]"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                          unlocked
                            ? "border-accent/45 bg-accent-soft text-accent-ink"
                            : "border-line text-faint group-hover/row:border-line-3",
                        )}
                      >
                        {unlocked ? <Play className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-medium text-ink">
                            <span className="mr-2 font-mono text-[12px] tabular-nums text-faint">
                              {String(lesson.index + 1).padStart(2, "0")}
                            </span>
                            {lesson.title}
                          </span>
                          {lesson.free && lesson.index === 0 && <Badge tone="success">{d.learn.firstLessonFree}</Badge>}
                        </span>
                        {lesson.description && (
                          <span className="mt-1 block text-[13px] leading-snug text-ink-3">{lesson.description}</span>
                        )}
                      </span>

                      <span className="shrink-0 pt-0.5 font-mono text-[12px] text-faint tabular-nums">
                        {lesson.duration}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </details>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
