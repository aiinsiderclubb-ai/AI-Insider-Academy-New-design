import { Star } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { DIFFICULTY } from "@/content/site";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The scale the catalogue already keeps: one to three stars. */
const LEVELS = [1, 2, 3] as const;

function note(level: number, locale: Locale) {
  if (level === 1) return pick(locale, "Старт с нуля — опыт не нужен", "From zero — no experience needed");
  if (level === 2) return pick(locale, "Нужна база: браузер, документы, немного практики", "Some basics: a browser, documents, a little practice");
  return pick(locale, "Уверенная работа с инструментами и логикой", "Confident with tools and with logic");
}

function name(level: number, locale: Locale) {
  const entry = DIFFICULTY[String(level)];
  return locale === "en" ? entry.en : entry.ru;
}

/* -------------------------------------------------------------------------- */

/**
 * Three stars, filled to the course's level.
 *
 * One glyph, two states — the empty star keeps its outline so the scale is
 * always three wide and two courses can be compared at a glance. Screen
 * readers get the number instead of five identical star labels.
 */
export function DifficultyStars({
  value,
  size = 16,
  gap = "gap-1",
  className,
  animate = false,
  label,
}: {
  value: number;
  size?: number;
  gap?: string;
  className?: string;
  /** Stagger the fill when the row scrolls into view. */
  animate?: boolean;
  label?: string;
}) {
  const stars = LEVELS.map((level) => {
    const filled = level <= value;
    const star = (
      <Star
        style={{ width: size, height: size }}
        className={cn(filled ? "fill-current text-accent" : "text-line-3", "shrink-0")}
        strokeWidth={filled ? 1.5 : 1.75}
        aria-hidden
      />
    );
    return animate ? (
      <Reveal key={level} as="span" delay={(level - 1) * 110} distance={0} className="inline-flex">
        {star}
      </Reveal>
    ) : (
      <span key={level} className="inline-flex">
        {star}
      </span>
    );
  });

  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center", gap, className)}>
      {stars}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The level, stated and placed.
 *
 * A number on its own means nothing — "medium" only reads once you can see
 * what sits either side of it. The ladder shows all three rungs and marks the
 * one this course stands on, so the answer to "is this for me?" is one glance
 * rather than a comparison across tabs.
 */
export function DifficultyLadder({
  value,
  locale,
  heading,
}: {
  value: number;
  locale: Locale;
  heading: string;
}) {
  return (
    <div>
      <p className="eyebrow">{heading}</p>

      <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
        <DifficultyStars
          value={value}
          size={44}
          gap="gap-2.5"
          animate
          label={pick(locale, `Сложность ${value} из 3`, `Difficulty ${value} of 3`)}
        />
        {/* The level is named here and explained one row below, on the ladder —
            printing the same sentence twice would only pad the block. */}
        <p className="font-display text-[clamp(1.75rem,3.2vw,2.5rem)] leading-none font-extrabold tracking-[-0.035em] text-ink">
          {name(value, locale)}
        </p>
      </div>

      <ol className="mt-9 border-t border-line">
        {LEVELS.map((level, index) => {
          const active = level === value;
          return (
            <Reveal
              as="li"
              key={level}
              delay={index * 70}
              distance={10}
              className={cn(
                "flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-line py-4 transition-colors",
                active ? "text-ink" : "text-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 self-center rounded-full transition-colors",
                  active ? "bg-accent" : "bg-line-2",
                )}
              />
              <DifficultyStars value={level} size={13} gap="gap-0.5" className={cn(!active && "opacity-55")} />
              <span className={cn("min-w-24 text-[14.5px]", active ? "font-semibold text-ink" : "font-normal")}>
                {name(level, locale)}
              </span>
              <span className={cn("text-[13.5px] leading-snug", active ? "text-ink-2" : "text-faint")}>
                {note(level, locale)}
              </span>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
