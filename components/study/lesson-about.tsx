import { ArrowRight, Box, ClipboardList, Sparkles, Target } from "lucide-react";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n/config";

export interface StudyLessonAbout {
  summary: string;
  points: string[];
  outcome: string;
  tools: string[];
}

/**
 * The "About this lesson" tab: what the lesson is for, what it walks through,
 * what the learner walks away with and which tools it uses — written from the
 * lesson's own recording. A lesson without that write-up still gets a tidy
 * card with its catalogue line instead of a bare sentence.
 */
export function LessonAbout({
  about,
  description,
  locale,
  onHomework,
  onMaterials,
  materialsCount,
}: {
  about: StudyLessonAbout | null;
  description: string;
  locale: Locale;
  /** Jump to the assignment tab, when the lesson has one. */
  onHomework?: () => void;
  onMaterials?: () => void;
  materialsCount: number;
}) {
  const summary = about?.summary || description;

  return (
    <div className="flex flex-col gap-5">
      {/* --------------------------------- lead --------------------------------- */}
      <div className="lesson-about-lead relative overflow-hidden rounded-2xl border border-line-2 p-6 sm:p-7">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {pick(locale, "О чём урок", "What this lesson is about")}
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-ink sm:text-[18px]">{summary}</p>
      </div>

      {about && about.points.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* ------------------------------ walkthrough ------------------------------ */}
          <section className="rounded-2xl border border-line bg-surface p-6">
            <p className="eyebrow">{pick(locale, "Что разберём", "What we cover")}</p>
            <ol className="mt-5 flex flex-col gap-4">
              {about.points.map((point, i) => (
                <li key={point} className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[12px] font-semibold text-accent-ink tabular-nums">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-[14.5px] leading-relaxed text-ink-2">{point}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-col gap-5">
            {/* -------------------------------- outcome -------------------------------- */}
            {about.outcome && (
              <section className="rounded-2xl border border-accent/40 bg-accent-soft p-6">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-accent-ink">
                  <Target className="h-4 w-4" aria-hidden />
                  {pick(locale, "Что получится в итоге", "What you end up with")}
                </p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink">{about.outcome}</p>
              </section>
            )}

            {/* --------------------------------- tools --------------------------------- */}
            {about.tools.length > 0 && (
              <section className="rounded-2xl border border-line bg-surface p-6">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                  <Box className="h-4 w-4 text-accent" aria-hidden />
                  {pick(locale, "Инструменты", "Tools")}
                </p>
                <ul className="mt-3.5 flex flex-wrap gap-2">
                  {about.tools.map((tool) => (
                    <li key={tool} className="rounded-full border border-line-2 bg-surface-2 px-3 py-1 text-[13px] text-ink-2">
                      {tool}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------- next steps ------------------------------- */}
      {(onHomework || (onMaterials && materialsCount > 0)) && (
        <div className="flex flex-wrap gap-3">
          {onHomework && (
            <button
              type="button"
              onClick={onHomework}
              className="group inline-flex items-center gap-2.5 rounded-full border border-line-2 bg-surface px-4 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:border-accent/50 hover:bg-surface-2"
            >
              <ClipboardList className="h-4 w-4 text-accent" aria-hidden />
              {pick(locale, "Задание к уроку", "The lesson's assignment")}
              <ArrowRight className="h-3.5 w-3.5 text-faint transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </button>
          )}
          {onMaterials && materialsCount > 0 && (
            <button
              type="button"
              onClick={onMaterials}
              className="group inline-flex items-center gap-2.5 rounded-full border border-line-2 bg-surface px-4 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:border-accent/50 hover:bg-surface-2"
            >
              <Box className="h-4 w-4 text-accent" aria-hidden />
              {pick(locale, `Материалы · ${materialsCount}`, `Materials · ${materialsCount}`)}
              <ArrowRight className="h-3.5 w-3.5 text-faint transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
