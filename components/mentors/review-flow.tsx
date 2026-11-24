import { ClipboardCheck, MessagesSquare, Upload } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";

/** How a review goes: three quiet columns in one card, divided by hairlines. */
export function ReviewFlow({ locale }: { locale: Locale }) {
  const steps = [
    {
      icon: Upload,
      title: pick(locale, "Сдаёте задание", "You hand in the assignment"),
      body: pick(
        locale,
        "Каждый урок заканчивается практикой. Работу отправляете прямо из кабинета.",
        "Every lesson ends in practice. You submit your work straight from your cabinet.",
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
    },
    {
      icon: MessagesSquare,
      title: pick(locale, "Доводите до результата", "You take it to the finish"),
      body: pick(
        locale,
        "Вопросы по ходу курса и приёмка финального проекта — до готовой системы, а не до галочки.",
        "Questions along the way and a sign-off on your final project — until the system works, not until a box is ticked.",
      ),
    },
  ];

  return (
    <Reveal>
      <ol className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="review-step group relative bg-surface p-8 sm:p-10">
            <div className="flex items-center justify-between">
              <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden />
              <span className="font-mono text-[12px] tracking-[0.2em] text-faint">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h3 className="mt-12 text-[20px] leading-tight">{title}</h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-3">{body}</p>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

export function ReviewFlowHead({ locale }: { locale: Locale }) {
  return (
    <Reveal>
      <p className="eyebrow flex items-center gap-3">
        <span className="rule-accent inline-block w-7" aria-hidden />
        {pick(locale, "Тариф «С ментором»", "The mentor plan")}
      </p>
      <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
        {pick(locale, "Как проходит проверка", "How the review works")}
      </h2>
    </Reveal>
  );
}
