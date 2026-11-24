import Image from "next/image";
import { pick } from "@/content/locale";
import type { Mentor } from "@/content/mentors";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * Positions on a 600 × 500 stage, in percent so the stage scales as a whole.
 * Portraits are 4:5; their centres are where the thread passes through.
 */
const SLOTS = [
  { left: 2, top: 30, width: 30, delay: "0s" },
  { left: 33, top: 4, width: 34, delay: "-2s" },
  { left: 68, top: 30, width: 30, delay: "-4s" },
] as const;
/* Runs just under the name tags at the foot of each portrait, pinned by a node under each. */
const THREAD = "M102 408 C 170 408, 230 308, 300 308 C 370 308, 430 408, 498 408";
const PINS = [
  [102, 408],
  [300, 308],
  [498, 408],
] as const;

/**
 * The mentors as a small constellation: three portraits on a slowly turning
 * orbit, strung on one glowing thread with a spark running along it, each
 * with a name tag, and a few notes floating around what they do together.
 */
export function MentorConstellation({ mentors, locale }: { mentors: Mentor[]; locale: Locale }) {
  const notes = [
    { text: pick(locale, "Ведут уроки", "Teach the lessons"), className: "left-[0%] top-[8%]", delay: "-1s" },
    { text: pick(locale, "Проверяют работы", "Review the work"), className: "right-[0%] top-[12%]", delay: "-3s" },
    { text: pick(locale, "Отвечают на вопросы", "Answer questions"), className: "left-[30%] bottom-[2%]", delay: "-5s" },
  ];

  return (
    <div className="constellation relative mx-auto aspect-[6/5] w-full max-w-[640px]">
      <svg viewBox="0 0 600 500" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="thread-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--accent-strong)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="thread-spark">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="45%" stopColor="var(--accent-strong)" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="constellation-orbit" cx="300" cy="270" rx="292" ry="200" />
        <ellipse className="constellation-orbit constellation-orbit-inner" cx="300" cy="270" rx="220" ry="150" />
      </svg>

      {notes.map((note) => (
        <span
          key={note.text}
          className={cn(
            "constellation-note absolute z-20 hidden items-center gap-2 rounded-full border border-line-2 bg-surface/80 px-3 py-1.5 text-[12px] text-ink-2 shadow-sm backdrop-blur-md sm:inline-flex",
            note.className,
          )}
          style={{ animationDelay: note.delay }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          {note.text}
        </span>
      ))}

      {mentors.slice(0, 3).map((mentor, i) => {
        const slot = SLOTS[i];
        const name = pick(locale, mentor.nameRu, mentor.name);
        return (
          <a
            key={mentor.id}
            href={`#${mentor.id}`}
            className="constellation-star group absolute z-10"
            style={{ left: `${slot.left}%`, top: `${slot.top}%`, width: `${slot.width}%`, animationDelay: slot.delay }}
          >
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[22px] border border-line-3 bg-surface-3 shadow-lg transition-[transform,border-color,box-shadow] duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1.5 group-hover:border-accent/60 group-hover:shadow-glow">
              <Image
                src={mentor.photo}
                alt={name}
                fill
                priority={i === 1}
                sizes="(min-width: 1024px) 220px, 32vw"
                className="object-cover object-[50%_30%] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
              />
              <span aria-hidden className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 to-transparent" />
            </span>
            <span className="absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white shadow-md backdrop-blur-md sm:text-[13px]">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              {name.split(" ")[0]}
            </span>
          </a>
        );
      })}

      {/* the thread is drawn over the portraits, tying their name tags together */}
      <svg viewBox="0 0 600 500" className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden>
        <path d={THREAD} className="constellation-thread-glow" />
        <path d={THREAD} stroke="url(#thread-gradient)" className="constellation-thread" />
        {PINS.map(([cx, cy]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r="9" className="constellation-pin-halo" />
            <circle cx={cx} cy={cy} r="4.5" className="constellation-pin" />
          </g>
        ))}
        <circle r="10" fill="url(#thread-spark)">
          <animateMotion dur="5s" repeatCount="indefinite" path={THREAD} keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
        </circle>
      </svg>
    </div>
  );
}
