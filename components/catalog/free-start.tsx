import { CirclePlay, CreditCard, MessageSquareCheck, Play, Timer, Users } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Spotlight } from "@/components/motion/pointer";
import { pick } from "@/content/locale";
import type { Course } from "@/lib/api/catalog";
import { lessonCount, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LaunchButton } from "./launch-button";

/**
 * How to start a free course (or apply to the intake).
 *
 * A card with a slowly travelling rim of light, the word "free" catching the
 * same light, three plain promises, and the first lessons laid out as a small
 * stack so the visitor sees what opens the moment they register.
 */
export function FreeStart({ course, locale, d }: { course: Course; locale: Locale; d: Dictionary }) {
  const intake = course.isIntake;
  const preview = course.lessons.slice(0, 3);
  const more = course.lessons.length - preview.length;

  const perks = intake
    ? [
        { icon: Users, text: pick(locale, "Места ограничены", "Limited places") },
        { icon: MessageSquareCheck, text: pick(locale, "Куратор проверяет работы", "A curator reviews your work") },
        { icon: CirclePlay, text: lessonCount(course.lessonCount, locale, d) },
      ]
    : [
        { icon: CreditCard, text: pick(locale, "Без карты", "No card needed") },
        { icon: Timer, text: pick(locale, "Минута на регистрацию", "One minute to sign up") },
        { icon: CirclePlay, text: lessonCount(course.lessonCount, locale, d) },
      ];

  return (
    <Reveal>
      <div className="free-start">
        <Spotlight className="free-start-inner relative">
          <div className="relative z-10 grid gap-12 p-7 sm:p-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:p-12">
            {/* --------------------------------- pitch --------------------------------- */}
            <div>
              <p className="flex items-center gap-2.5 font-mono text-[11.5px] tracking-[0.18em] text-ink-3 uppercase">
                <span className="free-start-pulse relative inline-block h-2 w-2 rounded-full bg-success" aria-hidden />
                {intake ? pick(locale, "Набор открыт", "Applications open") : pick(locale, "Открыто сейчас", "Open now")}
              </p>

              <p className="free-start-word mt-5 font-display text-[clamp(3rem,7.5vw,5.75rem)] leading-[0.9] font-extrabold tracking-[-0.035em]">
                {d.common.free}
              </p>

              <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-2">
                {intake
                  ? pick(
                      locale,
                      "Курс бесплатный, но места ограничены — куратор проверяет каждую работу. Заполните короткую анкету, ответ придёт на почту.",
                      "The course is free, but places are limited: a curator reviews every assignment. Fill in a short application and we will reply by email.",
                    )
                  : pick(
                      locale,
                      "Регистрация занимает минуту — уроки открываются сразу.",
                      "Registration takes a minute and the lessons open immediately.",
                    )}
              </p>

              <ul className="mt-7 flex flex-wrap gap-2">
                {perks.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface-2/70 px-3.5 py-1.5 text-[13px] text-ink-2 backdrop-blur-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="mt-9">
                <LaunchButton
                  href={intake ? path(`/learn/${course.slug}/apply`, locale) : path(`/register?next=/learn/${course.slug}`, locale)}
                  label={intake ? d.learn.apply : d.learn.startFree}
                  pendingLabel={intake ? pick(locale, "Открываем анкету…", "Opening the form…") : pick(locale, "Открываем…", "Opening…")}
                />
              </div>
            </div>

            {/* ------------------------------ first lessons ----------------------------- */}
            {preview.length > 0 && (
              <div className="free-start-stack group relative min-w-0" aria-label={pick(locale, "Первые уроки", "First lessons")}>
                <ol className="relative flex flex-col gap-3">
                  {preview.map((lesson, i) => (
                    <li
                      key={lesson.id}
                      className={cn(
                        "free-start-lesson flex items-center gap-4 rounded-2xl border bg-surface-2/85 p-4 shadow-sm backdrop-blur-md sm:p-5",
                        i === 0 ? "border-accent/45" : "border-line-2",
                      )}
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                          i === 0 ? "bg-accent text-on-accent" : "bg-surface-3 text-ink-2",
                        )}
                      >
                        <Play className="h-4 w-4 translate-x-px fill-current" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                          {pick(locale, "Урок", "Lesson")} {String(i + 1).padStart(2, "0")}
                          {lesson.duration && ` · ${lesson.duration}`}
                        </span>
                        <span className="mt-1 block truncate text-[14.5px] font-medium text-ink">
                          {/* the number already sits in the label above */}
                          {lesson.title.replace(/^(урок|lesson)\s*\d+\s*[.:—–-]\s*/i, "")}
                        </span>
                      </span>
                      {i === 0 && (
                        <span className="hidden shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent-ink sm:inline">
                          {pick(locale, "сразу", "instantly")}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                {more > 0 && (
                  <p className="mt-4 pl-1 font-mono text-[12px] tracking-[0.08em] text-faint">
                    + {lessonCount(more, locale, d)}
                  </p>
                )}
              </div>
            )}
          </div>
        </Spotlight>
      </div>
    </Reveal>
  );
}
