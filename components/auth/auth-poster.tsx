"use client";

import * as React from "react";
import type { Locale } from "@/lib/i18n/config";
import { AsciiField } from "./ascii-field";

/*
 * The right half of the sign-in pages, set like a poster.
 *
 * Behind: a living field of monospace characters the pointer burns through.
 * In front: the school's line in the site's display face, the second half on
 * the orange block the rest of the site uses for its marked words, and a
 * frame of small mono annotations — an issue number, the visitor's local
 * time, where the pointer is in the field.
 */

const COPY: Record<
  Locale,
  { kicker: string; status: string; first: string; second: string; body: string; points: string[]; time: string }
> = {
  ru: {
    kicker: "Школа AI-систем без воды",
    status: "Открыто",
    first: "Меньше хайпа.",
    second: "Больше систем.",
    body: "Курсы с проверкой заданий, готовые n8n-системы и сообщество практиков. Один аккаунт — на всё.",
    points: ["Курсы Academy", "Готовые AI-системы", "Сообщество практиков"],
    time: "Местное время",
  },
  ukr: {
    kicker: "Школа AI-систем без води",
    status: "Відкрито",
    first: "Менше хайпу.",
    second: "Більше систем.",
    body: "Курси з перевіркою завдань, готові n8n-системи та спільнота практиків. Один акаунт — на все.",
    points: ["Курси Academy", "Готові AI-системи", "Спільнота практиків"],
    time: "Місцевий час",
  },
  en: {
    kicker: "A school of AI systems, no fluff",
    status: "Open",
    first: "Less hype.",
    second: "More systems.",
    body: "Courses with reviewed assignments, ready-made n8n systems and a community of practitioners. One account for all of it.",
    points: ["Academy courses", "Ready-made AI systems", "A practitioners' community"],
    time: "Local time",
  },
};

/** The visitor's clock, ticking. Rendered after mount so server and client agree. */
function Clock() {
  const [now, setNow] = React.useState<string | null>(null);
  React.useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setNow(format());
    const timer = window.setInterval(() => setNow(format()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{now ?? "--:--:--"}</span>;
}

export function AuthPoster({ locale }: { locale: Locale }) {
  const copy = COPY[locale] ?? COPY.ru;
  const readout = React.useRef<HTMLSpanElement>(null);

  // Written straight to the DOM: a re-render per pointer move would be waste.
  const onPointer = React.useCallback((x: number, y: number) => {
    if (readout.current) readout.current.textContent = `X ${x.toFixed(3)} · Y ${y.toFixed(3)}`;
  }, []);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ground-deep text-ink">
      <AsciiField className="absolute inset-0" onPointer={onPointer} />

      {/* Legibility: the field thins out under the words and towards the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(5 5 4 / 0.92) 0%, rgb(5 5 4 / 0.6) 11%, transparent 24%, transparent 44%, rgb(5 5 4 / 0.94) 78%), radial-gradient(120% 90% at 50% 50%, transparent 55%, rgb(5 5 4 / 0.7) 100%)",
        }}
      />

      {/* ------------------------------- top rule ------------------------------ */}
      <div className="pointer-events-none relative flex items-start justify-between gap-6 px-10 pt-9 font-mono text-[10.5px] tracking-[0.18em] text-muted uppercase xl:px-12">
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-2">AI Insider — Academy</span>
          <span>{copy.kicker}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <span className="flex items-center gap-2 text-ink-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            N°001 · {copy.status}
          </span>
          <span>
            {copy.time} <Clock />
          </span>
        </div>
      </div>

      {/* ------------------------------- the line ------------------------------ */}
      <div className="pointer-events-none relative mt-auto px-10 pb-10 xl:px-12">
        <h2 className="font-display text-[clamp(3rem,5.4vw,5.6rem)] leading-[0.92] font-extrabold tracking-[-0.055em] text-ink">
          <span className="block">{copy.first}</span>
          <span className="mt-[0.12em] inline-block bg-accent px-[0.14em] pb-[0.06em] text-on-accent">{copy.second}</span>
        </h2>

        <p className="mt-7 max-w-md text-[15px] leading-relaxed text-ink-2">{copy.body}</p>

        <div className="mt-9 grid grid-cols-3 gap-6 border-t border-line-2 pt-5">
          {copy.points.map((point, index) => (
            <div key={point}>
              <span className="font-mono text-[10.5px] tracking-[0.18em] text-accent">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-2 text-[13px] leading-snug text-ink-2">{point}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
          <span ref={readout} className="tabular-nums">
            X 0.000 · Y 0.000
          </span>
          <span>RU · UA · EN</span>
        </div>
      </div>
    </div>
  );
}
