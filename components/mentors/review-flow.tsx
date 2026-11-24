import { Check, ClipboardCheck, FileCode2, MessagesSquare, Upload } from "lucide-react";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { gradingStandard } from "@/content/catalog";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";

/**
 * How a review goes, as three stations on one lit track. Each card carries a
 * small live scene of its step: a file going up, the grading levels being
 * ticked, a project being signed off.
 */
export function ReviewFlow({ locale }: { locale: Locale }) {
  const levels = gradingStandard[locale === "en" ? "en" : "ru"].levels.map((level) => level.name);

  const steps = [
    {
      icon: Upload,
      title: pick(locale, "Сдаёте задание", "You hand in the assignment"),
      body: pick(
        locale,
        "Каждый урок заканчивается практикой. Работу отправляете прямо из кабинета.",
        "Every lesson ends in practice. You submit your work straight from your cabinet.",
      ),
      scene: (
        <div className="review-scene">
          <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-surface-2 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
              <FileCode2 className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[12px] text-ink-2">
                {pick(locale, "задание-03.json", "assignment-03.json")}
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span className="review-progress block h-full rounded-full bg-accent" />
              </span>
            </span>
          </div>
        </div>
      ),
    },
    {
      icon: ClipboardCheck,
      title: pick(locale, "Ментор проверяет", "A mentor reviews it"),
      body: pick(
        locale,
        "Разбор по критериям Стандарта проверки Академии — что работает, что доделать и почему.",
        "A review against the Academy grading standard: what works, what to finish, and why.",
      ),
      scene: (
        <div className="review-scene flex flex-col gap-1.5">
          {levels.map((level, i) => (
            <div
              key={level}
              className="flex items-center justify-between rounded-lg border border-line-2 bg-surface-2 px-3 py-2"
            >
              <span className="text-[12.5px] text-ink-2">{level}</span>
              <span className="review-tick grid h-5 w-5 place-items-center rounded-full bg-success text-white" style={{ animationDelay: `${i * 0.45}s` }}>
                <Check className="h-3 w-3" aria-hidden />
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: MessagesSquare,
      title: pick(locale, "Доводите до результата", "You take it to the finish"),
      body: pick(
        locale,
        "Вопросы по ходу курса и приёмка финального проекта — до готовой системы, а не до галочки.",
        "Questions along the way and a sign-off on your final project — until the system works, not until a box is ticked.",
      ),
      scene: (
        <div className="review-scene relative flex flex-col gap-2">
          <span className="review-bubble self-start rounded-2xl rounded-bl-md border border-line-2 bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            {pick(locale, "Финальный проект готов", "Final project is ready")}
          </span>
          <span
            className="review-bubble self-end rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[12.5px] font-medium text-on-accent"
            style={{ animationDelay: "0.6s" }}
          >
            {pick(locale, "Принято ✓", "Signed off ✓")}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="relative">
      {/* the track the three stations sit on */}
      <span aria-hidden className="review-track hidden lg:block" />
      <span aria-hidden className="review-track-vertical lg:hidden" />

      <RevealGroup step={120} className="relative grid gap-6 lg:grid-cols-3 lg:gap-6">
        {steps.map(({ icon: Icon, title, body, scene }, i) => (
          <article key={title} className="review-card group relative flex h-full flex-col pl-16 lg:pt-14 lg:pl-0">
            <span className="review-node absolute top-0 left-0 grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent lg:left-1/2 lg:-translate-x-1/2">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="mentor-card relative flex h-full flex-col overflow-hidden rounded-[24px] border border-line-2 p-6 transition-[transform,border-color] duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1.5 group-hover:border-accent/45 sm:p-7">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-4 -right-2 font-display text-[110px] leading-none font-extrabold text-line-2/60 tabular-nums select-none"
              >
                {i + 1}
              </span>
              <p className="relative font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">
                {pick(locale, "Шаг", "Step")} {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="relative mt-3 text-[20px] leading-tight">{title}</h3>
              <p className="relative mt-3 text-[14.5px] leading-relaxed text-ink-3">{body}</p>
              <div className="relative mt-auto pt-7">{scene}</div>
            </div>
          </article>
        ))}
      </RevealGroup>
    </div>
  );
}

export function ReviewFlowHead({ locale }: { locale: Locale }) {
  return (
    <Reveal>
      <p className="eyebrow flex items-center gap-3">
        <span className="rule-accent inline-block w-7" aria-hidden />
        {pick(locale, "Тариф «С ментором»", "The mentor plan")}
      </p>
      <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.2rem,5vw,3.75rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
        {pick(locale, "Как проходит", "How the review")} <span className="text-accent">{pick(locale, "проверка", "works")}</span>
      </h2>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
        {pick(
          locale,
          "Три шага от первой сданной работы до принятого финального проекта.",
          "Three steps from your first submitted piece of work to a signed-off final project.",
        )}
      </p>
    </Reveal>
  );
}
