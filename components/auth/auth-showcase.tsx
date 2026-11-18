"use client";

import * as React from "react";
import { Bell, Bot, Database, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/*
 * The right half of the sign-in pages: an AI system running on its own.
 *
 * A glowing core sits in a tilted 3D stage with four working parts around it
 * — a Telegram trigger, an AI agent, a CRM and the manager it notifies. Every
 * 1.7 s the next step fires: a packet of light travels the wire, the part it
 * reaches lights up, the core ripples, and a console underneath types out
 * what just happened. The stage leans after the pointer.
 *
 * It is labelled as an example, and it is one: nothing here claims a number
 * the academy has not earned.
 *
 * Everything moves with CSS (transforms, offset-path) so the browser keeps it
 * on the compositor; React only advances the step. Visitors who prefer
 * reduced motion get the finished picture, still.
 */

const STAGE = { width: 600, height: 430 };
const CORE = { x: 300, y: 215 };
const STEP_MS = 1700;

type NodeId = "trigger" | "agent" | "crm" | "notify";

const NODES: { id: NodeId; x: number; y: number; Icon: typeof Send; title: Record<Locale, string>; role: Record<Locale, string> }[] = [
  { id: "trigger", x: 104, y: 90, Icon: Send, title: { ru: "Telegram", ukr: "Telegram", en: "Telegram" }, role: { ru: "Триггер", ukr: "Тригер", en: "Trigger" } },
  { id: "agent", x: 496, y: 84, Icon: Bot, title: { ru: "Claude", ukr: "Claude", en: "Claude" }, role: { ru: "AI-агент", ukr: "AI-агент", en: "AI agent" } },
  { id: "crm", x: 504, y: 338, Icon: Database, title: { ru: "CRM", ukr: "CRM", en: "CRM" }, role: { ru: "База клиентов", ukr: "База клієнтів", en: "Client base" } },
  { id: "notify", x: 98, y: 346, Icon: Bell, title: { ru: "Менеджер", ukr: "Менеджер", en: "Manager" }, role: { ru: "Уведомление", ukr: "Сповіщення", en: "Notification" } },
];

/** Background parts, out of focus, further back — depth, not information. */
const FAR = [
  { label: "n8n", x: 300, y: 22 },
  { label: "GPT-4o", x: 200, y: 412 },
  { label: "Sheets", x: 404, y: 416 },
  { label: "Voice", x: 22, y: 218 },
  { label: "Gemini", x: 578, y: 212 },
];

/** A gentle curve from a part to the core, bowing away from the centre line. */
function wire(x: number, y: number) {
  const mx = (x + CORE.x) / 2;
  const my = (y + CORE.y) / 2;
  const bend = (x < CORE.x ? -1 : 1) * 46;
  return `M ${x} ${y} Q ${mx + bend * 0.4} ${my + bend * (y < CORE.y ? 1 : -1) * 0.6} ${CORE.x} ${CORE.y}`;
}

const WIRES = Object.fromEntries(NODES.map((node) => [node.id, wire(node.x, node.y)])) as Record<NodeId, string>;

/** One run of the system: which wire carries light, which way, which part lights up. */
const STEPS: { wire: NodeId | null; toCore: boolean; lit: NodeId | null }[] = [
  { wire: "trigger", toCore: true, lit: "trigger" },
  { wire: "agent", toCore: false, lit: "agent" },
  { wire: "agent", toCore: true, lit: "agent" },
  { wire: "crm", toCore: false, lit: "crm" },
  { wire: "notify", toCore: false, lit: "notify" },
  { wire: null, toCore: false, lit: null },
];

const LOG: Record<Locale, string[]> = {
  ru: [
    "Новая заявка в Telegram: «Нужен бот для записи клиентов»",
    "Заявка передана AI-агенту",
    "Claude: лид горячий · ниша — салон красоты · бюджет есть",
    "Карточка клиента создана в CRM",
    "Менеджер получил уведомление с готовым ответом",
    "Готово за 1,8 с — без участия человека",
  ],
  ukr: [
    "Нова заявка в Telegram: «Потрібен бот для запису клієнтів»",
    "Заявку передано AI-агенту",
    "Claude: лід гарячий · ніша — салон краси · бюджет є",
    "Картку клієнта створено в CRM",
    "Менеджер отримав сповіщення з готовою відповіддю",
    "Готово за 1,8 с — без участі людини",
  ],
  en: [
    "New lead in Telegram: “Need a bot to book clients”",
    "Lead handed to the AI agent",
    "Claude: hot lead · niche — beauty salon · has budget",
    "Client card created in the CRM",
    "Manager notified, with a reply drafted",
    "Done in 1.8 s — no human in the loop",
  ],
};

const COPY: Record<Locale, { title: string; mark: string; body: string; example: string; console: string; perks: string[] }> = {
  ru: {
    title: "Один аккаунт.",
    mark: "Все ваши AI-системы.",
    body: "Готовые AI-системы, сообщество практиков и Academy, которая вот-вот откроется, — в одном месте. Регистрация бесплатная.",
    example: "Пример · AI-обработка заявок",
    console: "демо-запуск",
    perks: ["Готовые n8n-системы", "Сообщество практиков", "Ранний доступ к Academy"],
  },
  ukr: {
    title: "Один акаунт.",
    mark: "Усі ваші AI-системи.",
    body: "Готові AI-системи, спільнота практиків і Academy, яка ось-ось відкриється, — в одному місці. Реєстрація безкоштовна.",
    example: "Приклад · AI-обробка заявок",
    console: "демо-запуск",
    perks: ["Готові n8n-системи", "Спільнота практиків", "Ранній доступ до Academy"],
  },
  en: {
    title: "One account.",
    mark: "Every AI system you build.",
    body: "Ready-made AI systems, a community of practitioners and an Academy about to open — all in one place. Signing up is free.",
    example: "Example · AI lead handling",
    console: "demo run",
    perks: ["Ready-made n8n systems", "A practitioners' community", "Early access to Academy"],
  },
};

/** Fixed sparkle positions — the same on server and client, so no hydration drift. */
const SPARKS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37.7) % 100,
  top: (i * 61.3 + 13) % 100,
  delay: (i * 0.73) % 5,
  size: i % 3 === 0 ? 2 : 1,
}));

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function AuthShowcase({ locale, tagline }: { locale: Locale; tagline: string }) {
  const copy = COPY[locale] ?? COPY.ru;
  const log = LOG[locale] ?? LOG.ru;
  const reduced = useReducedMotion();

  // One counter drives everything: the step within a run, and which run it is.
  const [tick, setTick] = React.useState(0);
  const step = reduced ? STEPS.length - 1 : tick % STEPS.length;
  const run = 1042 + Math.floor(tick / STEPS.length);
  const [typed, setTyped] = React.useState(0);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const fitRef = React.useRef<HTMLDivElement>(null);
  const tiltRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  // Advance the run. Paused while the tab is hidden, so it never fast-forwards.
  React.useEffect(() => {
    if (reduced) return;
    let timer = 0;
    const start = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") timer = window.setInterval(() => setTick((value) => value + 1), STEP_MS);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [reduced]);

  // The newest console line types itself out.
  const line = log[step];
  React.useEffect(() => {
    if (reduced) {
      setTyped(line.length);
      return;
    }
    setTyped(0);
    const timer = window.setInterval(() => {
      setTyped((value) => {
        if (value >= line.length) {
          window.clearInterval(timer);
          return value;
        }
        return value + 2;
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [line, reduced]);

  // The stage is drawn at a fixed size and scaled to whatever room it has, so
  // the wires (SVG units) and the packets (CSS offset-path, px) agree.
  React.useEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.55, Math.min((width - 24) / STAGE.width, height / STAGE.height, 1.25)));
    });
    observer.observe(fit);
    return () => observer.disconnect();
  }, []);

  // Lean after the pointer, written straight to the style: no re-render per move.
  React.useEffect(() => {
    const host = hostRef.current;
    const tilt = tiltRef.current;
    if (!host || !tilt || reduced) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        tilt.style.setProperty("--rx", `${(-ny * 9).toFixed(2)}deg`);
        tilt.style.setProperty("--ry", `${(nx * 12).toFixed(2)}deg`);
        host.style.setProperty("--gx", `${((nx + 1) * 50).toFixed(1)}%`);
        host.style.setProperty("--gy", `${((ny + 1) * 50).toFixed(1)}%`);
      });
    };
    const onLeave = () => {
      tilt.style.setProperty("--rx", "0deg");
      tilt.style.setProperty("--ry", "0deg");
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  const current = STEPS[step];
  const done = step === STEPS.length - 1;
  const history = log.slice(Math.max(0, step - 2), step);

  return (
    <div ref={hostRef} className="auth-showcase relative flex h-full flex-col overflow-hidden">
      {/* ------------------------------- the sky ------------------------------ */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="auth-aurora auth-aurora-a" />
        <div className="auth-aurora auth-aurora-b" />
        <div className="auth-pointer-glow absolute inset-0" />
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            className="auth-spark absolute rounded-full bg-white"
            style={{
              left: `${spark.left}%`,
              top: `${spark.top}%`,
              width: spark.size,
              height: spark.size,
              animationDelay: `${spark.delay}s`,
            }}
          />
        ))}
        <div className="auth-floor" />
      </div>

      {/* ------------------------------- the words ---------------------------- */}
      <div className="relative z-10 px-12 pt-11">
        <p className="eyebrow text-ink-3">{tagline}</p>
        <p className="mt-6 max-w-lg font-display text-[clamp(1.9rem,2.6vw,2.75rem)] leading-[1.06] font-extrabold tracking-[-0.04em] text-ink">
          {copy.title}
          <br />
          <span className="auth-gradient-text">{copy.mark}</span>
        </p>
        <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-ink-3">{copy.body}</p>
      </div>

      {/* ------------------------------- the stage ---------------------------- */}
      <div ref={fitRef} className="relative z-10 min-h-0 flex-1 [perspective:1200px]">
        <div
          className="absolute top-1/2 left-1/2"
          style={{ width: STAGE.width, height: STAGE.height, transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <div ref={tiltRef} className="auth-tilt relative h-full w-full">
            {/* far parts, out of focus */}
            {FAR.map((part) => (
              <span
                key={part.label}
                aria-hidden
                className="auth-far absolute rounded-full border border-line-2 px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-muted uppercase"
                style={{ left: part.x, top: part.y }}
              >
                {part.label}
              </span>
            ))}

            {/* wires */}
            <svg
              aria-hidden
              viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              <defs>
                <linearGradient id="auth-wire" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                  <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              {NODES.map((node) => {
                const active = current.wire === node.id || done;
                return (
                  <g key={node.id}>
                    <path
                      d={WIRES[node.id]}
                      fill="none"
                      stroke="color-mix(in oklab, var(--accent) 22%, var(--line-2))"
                      strokeWidth="1"
                    />
                    {/* the glow under a wire while it carries something */}
                    <path
                      d={WIRES[node.id]}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      className={cn("auth-wire-glow transition-opacity duration-500", active ? "opacity-40" : "opacity-0")}
                    />
                    <path
                      d={WIRES[node.id]}
                      fill="none"
                      stroke="url(#auth-wire)"
                      strokeWidth={active ? 2 : 1.2}
                      strokeDasharray="3 7"
                      className={cn("auth-wire-flow transition-opacity duration-500", active ? "opacity-100" : "opacity-35")}
                    />
                  </g>
                );
              })}
            </svg>

            {/* the packet of light */}
            {current.wire && !reduced && (
              <span
                key={`${run}-${step}`}
                aria-hidden
                className={cn("auth-packet", current.toCore ? "auth-packet-in" : "auth-packet-out")}
                style={{ offsetPath: `path("${WIRES[current.wire]}")` }}
              />
            )}

            {/* the core */}
            <div className="auth-core-wrap absolute" style={{ left: CORE.x, top: CORE.y }}>
              <span className="auth-ring auth-ring-a" />
              <span className="auth-ring auth-ring-b" />
              <span className="auth-ring auth-ring-c" />
              {!reduced && <span key={`ripple-${run}-${step}`} className="auth-ripple" />}
              <span className={cn("auth-core", done && "auth-core-done")}>
                <span className="auth-core-swirl" />
                <span className="auth-core-shine" />
              </span>
            </div>

            {/* the working parts */}
            {NODES.map(({ id, x, y, Icon, title, role }) => {
              const lit = current.lit === id || done;
              return (
                <div
                  key={id}
                  className={cn("auth-node absolute", lit && "auth-node-lit")}
                  style={{ left: x, top: y }}
                >
                  <span className="auth-node-icon">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-tight font-semibold text-ink">{title[locale]}</span>
                    <span className="mt-0.5 block font-mono text-[9.5px] tracking-[0.14em] whitespace-nowrap text-muted uppercase">
                      {role[locale]}
                    </span>
                  </span>
                  <span className={cn("auth-node-dot", lit && "auth-node-dot-lit")} aria-hidden />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------ the console --------------------------- */}
      <div className="relative z-10 px-12 pb-9">
        <div className="auth-console rounded-2xl border border-line-2 p-4">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <span className="flex items-center gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
            </span>
            <span className="truncate font-mono text-[10.5px] tracking-[0.16em] text-muted uppercase">{copy.example}</span>
            <span className="shrink-0 font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
              {copy.console} · #{run}
            </span>
          </div>
          <ol className="mt-3 flex min-h-[5.4rem] flex-col justify-end gap-1.5 font-mono text-[12px] leading-snug" aria-hidden>
            {history.map((entry) => (
              <li key={`${run}-${entry}`} className="flex gap-2 text-muted">
                <span className="text-success">✓</span>
                <span className="truncate">{entry}</span>
              </li>
            ))}
            <li className="flex gap-2 text-ink-2">
              <span className={done ? "text-success" : "text-accent"}>{done ? "✓" : "›"}</span>
              <span className="truncate">
                {line.slice(0, typed)}
                {!reduced && <span className="auth-cursor" />}
              </span>
            </li>
          </ol>
        </div>

        <ul className="mt-5 flex flex-wrap gap-2">
          {copy.perks.map((perk) => (
            <li
              key={perk}
              className="rounded-full border border-line-2 bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] px-3 py-1.5 text-[12px] text-ink-3 backdrop-blur-md"
            >
              {perk}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
