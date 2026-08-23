import { ArrowRight, Check, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Reveal } from "@/components/motion/reveal";
import { Magnetic } from "@/components/motion/pointer";
import { pick } from "@/content/locale";
import { MENTOR_SURCHARGE_EUR } from "@/content/site";
import type { Course } from "@/lib/api/catalog";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * The one place a course price is composed.
 *
 * Two ways in, side by side, so nobody has to hunt for what the extra buys.
 * The mentor tier is the filled card because it is the one being recommended;
 * everything else on the page stays quiet enough for that to read.
 */
export function AccessTiers({
  course,
  locale,
  d,
  owned,
}: {
  course: Course;
  locale: Locale;
  d: Dictionary;
  owned?: boolean;
}) {
  const discount = course.oldPriceEur ? course.oldPriceEur - course.priceEur : 0;
  const mentorPrice = course.priceEur + MENTOR_SURCHARGE_EUR;
  const soon = course.status === "in-development";

  if (owned) {
    return (
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-success/35 bg-surface p-7 shadow-sm sm:p-9">
          <div>
            <p className="flex items-center gap-2 text-[14px] font-semibold text-success">
              <Check className="h-4 w-4" aria-hidden />
              {pick(locale, "Курс у вас есть", "You own this course")}
            </p>
            <p className="mt-2 text-[15px] text-ink-2">
              {pick(locale, "Продолжайте с того места, где остановились.", "Pick up where you left off.")}
            </p>
          </div>
          <Magnetic>
            <ButtonLink href={path(`/study/${course.slug}/1`, locale)} size="lg" className="group">
              {d.common.continue}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
          </Magnetic>
        </div>
      </Reveal>
    );
  }

  if (course.isFree || soon) {
    return (
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-8 rounded-2xl border border-line bg-surface p-7 shadow-sm sm:p-9">
          <div className="max-w-md">
            {soon ? <Badge tone="warning">{d.badges.soon}</Badge> : <p className="eyebrow">{d.learn.tabFree}</p>}
            <p className="mt-4 font-display text-[clamp(2.25rem,4vw,3rem)] leading-none font-extrabold tracking-tight text-ink">
              {soon ? formatPrice(course.priceEur, locale) : d.common.free}
            </p>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
              {soon
                ? d.study.videoSoonBody
                : pick(
                    locale,
                    "Регистрация занимает минуту — уроки открываются сразу.",
                    "Registration takes a minute and the lessons open immediately.",
                  )}
            </p>
          </div>
          <Magnetic>
            <ButtonLink
              href={soon ? path("/learn", locale) : path(`/register?next=/learn/${course.slug}`, locale)}
              variant={soon ? "secondary" : "primary"}
              size="lg"
              className="group"
            >
              {soon ? d.study.notifyMe : d.learn.startFree}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
          </Magnetic>
        </div>
      </Reveal>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* -------------------------------- on your own ------------------------------- */}
      <Reveal>
        <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-7 shadow-sm sm:p-9">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">{pick(locale, "Самостоятельно", "On your own")}</p>
            {discount > 0 && <Badge tone="accent">−{formatPrice(discount, locale)}</Badge>}
          </div>

          <p className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-[clamp(2.5rem,4.4vw,3.5rem)] leading-none font-extrabold tracking-tight tabular-nums text-ink">
              {formatPrice(course.priceEur, locale)}
            </span>
            {course.oldPriceEur && (
              <span className="font-mono text-[15px] text-faint line-through tabular-nums">
                {formatPrice(course.oldPriceEur, locale)}
              </span>
            )}
          </p>
          <p className="mt-2 text-[13px] text-muted">{d.common.forever}</p>

          <ul className="mt-7 flex flex-1 flex-col gap-2.5 border-t border-line pt-6">
            {[
              pick(locale, "Все уроки и материалы курса", "Every lesson and resource"),
              pick(locale, "Доступ навсегда, без подписки", "Lifetime access, no subscription"),
              pick(locale, "Обновления курса включены", "Course updates included"),
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <ButtonLink href={path(`/learn/${course.slug}/buy`, locale)} variant="secondary" size="lg" className="mt-7" full>
            {d.learn.buyCourse}
          </ButtonLink>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5">
            <li className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <Zap className="h-3.5 w-3.5 text-accent" aria-hidden />
              {d.checkout.instantAccess}
            </li>
            <li className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
              {d.checkout.securePayment}
            </li>
          </ul>
        </div>
      </Reveal>

      {/* --------------------------------- with mentor ------------------------------ */}
      <Reveal delay={90}>
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-accent p-7 text-on-accent shadow-lg sm:p-9">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ background: "radial-gradient(30rem 20rem at 100% 0%, rgb(255 255 255 / 0.5), transparent 62%)" }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {d.learn.withMentor}
            </p>
            <span className="rounded-full bg-on-accent/12 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
              {pick(locale, "рекомендуем", "recommended")}
            </span>
          </div>

          <p className="relative mt-5 flex items-baseline gap-3">
            <span className="font-display text-[clamp(2.5rem,4.4vw,3.5rem)] leading-none font-extrabold tracking-tight tabular-nums">
              {formatPrice(mentorPrice, locale)}
            </span>
            <span className="font-mono text-[14px] tabular-nums opacity-70">
              +{formatPrice(MENTOR_SURCHARGE_EUR, locale)}
            </span>
          </p>
          <p className="relative mt-2 text-[13px] opacity-75">{d.learn.mentorNote}</p>

          <ul className="relative mt-7 flex flex-1 flex-col gap-2.5 border-t border-on-accent/20 pt-6">
            {[
              pick(locale, "Проверка каждой домашней работы", "Every assignment reviewed"),
              pick(locale, "Приёмка финального проекта", "Final project signed off"),
              pick(locale, "Вопросы ментору весь курс", "Ask your mentor throughout"),
              pick(locale, "Именной сертификат в конце", "A named certificate at the end"),
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-snug">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <Magnetic className="relative mt-7 w-full">
            <ButtonLink
              href={path(`/learn/${course.slug}/buy?tier=mentor`, locale)}
              size="lg"
              className="group border border-transparent bg-on-accent text-accent hover:bg-on-accent hover:brightness-110"
              full
            >
              {d.learn.withMentor}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
          </Magnetic>
        </div>
      </Reveal>
    </div>
  );
}
