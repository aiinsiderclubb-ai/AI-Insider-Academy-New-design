import { CheckCircle2, ClipboardCheck, PackageCheck } from "lucide-react";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n/config";

/**
 * The assignment, laid out as a brief: the steps on a numbered track, what to
 * hand in on a highlighted card, and what it is checked against.
 */
export function HomeworkBrief({
  tasks,
  deliverables,
  criteria,
  locale,
  selfCheck,
}: {
  tasks: string[];
  deliverables: string[];
  criteria: string[];
  locale: Locale;
  selfCheck: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* ---------------------------------- steps ---------------------------------- */}
      <section className="homework-brief relative overflow-hidden rounded-2xl border border-line-2 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">
            {pick(locale, "Задание", "Assignment")}
          </p>
          <span className="rounded-full border border-line-2 bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-ink-3">
            {selfCheck ? pick(locale, "самопроверка", "self-check") : pick(locale, "проверяет ментор", "mentor-reviewed")}
          </span>
        </div>
        <ol className="homework-steps relative mt-6 flex flex-col gap-5">
          {tasks.map((task, i) => (
            <li key={task} className="relative flex gap-4">
              <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-mono text-[13px] font-semibold text-on-accent tabular-nums shadow-glow">
                {i + 1}
              </span>
              <span className="pt-1 text-[15px] leading-relaxed text-ink">{task}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* --------------------------------- hand in --------------------------------- */}
        <section className="rounded-2xl border border-accent/40 bg-accent-soft p-6">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-accent-ink">
            <PackageCheck className="h-4 w-4" aria-hidden />
            {selfCheck ? pick(locale, "Что должно получиться", "What you should end up with") : pick(locale, "Что сдать", "What to hand in")}
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {deliverables.map((item) => (
              <li key={item} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------- criteria --------------------------------- */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            <ClipboardCheck className="h-4 w-4 text-success" aria-hidden />
            {selfCheck ? pick(locale, "Как проверить себя", "How to check yourself") : pick(locale, "Как проверим", "How it is checked")}
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {criteria.map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
