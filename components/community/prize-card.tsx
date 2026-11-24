"use client";

import * as React from "react";
import { useFinePointer } from "@/components/motion/use-in-view";
import { cn } from "@/lib/utils";

/** A twelve-ray burst, drawn here rather than borrowed from any brand. */
function Burst({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="-50 -50 100 100" className={className} aria-hidden>
      {rays.map((angle, i) => (
        <rect
          key={angle}
          x={-3.2}
          y={-46}
          width={6.4}
          height={i % 2 ? 30 : 40}
          rx={3.2}
          transform={`rotate(${angle})`}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

/**
 * The prize as a collectible ticket: a holographic card that tilts toward the
 * pointer, with a glare that follows it, a slowly turning burst, perforation
 * and notches. On touch, or with reduced motion, it simply sits there, lit.
 */
export function PrizeCard({
  title,
  detail,
  eyebrow,
  footer,
  status,
  gradient,
  finished,
}: {
  title: string;
  detail: string;
  eyebrow: string;
  footer: { label: string; value: string }[];
  status: string;
  gradient: string;
  finished?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const fine = useFinePointer();

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !fine || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let px = 0.5;
    let py = 0.5;
    const apply = () => {
      frame = 0;
      node.style.setProperty("--rx", `${(0.5 - py) * 16}deg`);
      node.style.setProperty("--ry", `${(px - 0.5) * 20}deg`);
      node.style.setProperty("--px", `${px * 100}%`);
      node.style.setProperty("--py", `${py * 100}%`);
    };
    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      px = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      py = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
      node.dataset.live = "";
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      delete node.dataset.live;
      px = 0.5;
      py = 0.5;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [fine]);

  return (
    <div className="prize-stage relative mx-auto w-full max-w-[460px]">
      {/* orbits and sparks around the ticket */}
      <span aria-hidden className="prize-orbit prize-orbit-a" />
      <span aria-hidden className="prize-orbit prize-orbit-b" />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} aria-hidden className="prize-spark" style={{ "--n": i } as React.CSSProperties} />
      ))}

      <div ref={ref} className="prize-tilt relative">
        <div
          className={cn("prize-card relative overflow-hidden rounded-[28px] text-white", finished && "prize-card-done")}
          style={{ background: gradient }}
        >
          <span aria-hidden className="prize-holo" />
          <span aria-hidden className="prize-glare" />
          <span aria-hidden className="prize-grain" />

          <div className="relative flex items-center justify-between gap-3 px-7 pt-6">
            <span className="font-mono text-[10.5px] tracking-[0.22em] text-white/80 uppercase">{eyebrow}</span>
            <span className="rounded-full border border-white/25 bg-black/25 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase backdrop-blur-sm">
              {status}
            </span>
          </div>

          <div className="relative flex flex-col items-center px-7 pt-10 pb-12 text-center">
            <Burst className="prize-burst h-20 w-20 text-white/95 drop-shadow-[0_6px_24px_rgba(0,0,0,0.35)]" />
            <p className="mt-7 font-display text-[clamp(2.75rem,7vw,4rem)] leading-[0.9] font-extrabold tracking-[-0.04em] drop-shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
              {title}
            </p>
            <p className="mt-4 font-mono text-[13px] tracking-[0.3em] text-white/85 uppercase">{detail}</p>
          </div>

          {/* perforation with a notch on each side, like a torn-off stub */}
          <div className="prize-perf relative mx-7 border-t-2 border-dashed border-white/30" />
          <dl className="relative grid grid-cols-2 gap-4 px-7 pt-5 pb-6">
            {footer.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[10px] tracking-[0.18em] text-white/65 uppercase">{item.label}</dt>
                <dd className="mt-1.5 text-[14.5px] font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
