"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * The store's front page opens with its own table of contents: every category
 * set large, one per line, with how many systems it holds and where its prices
 * start. Pointing at a line lights it and the others step back, and a small
 * stack of that category's covers follows the pointer, so you see what is
 * inside before you go in. On touch screens, and for visitors who prefer
 * reduced motion, it is a plain list.
 */

export interface IndexRow {
  slug: string;
  label: string;
  description: string;
  count: number;
  /** Right-hand column, e.g. "от 19 €". */
  meta: string;
  covers: string[];
  href: string;
}

export function CategoryIndex({ rows }: { rows: IndexRow[] }) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const stackRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<number | null>(null);
  const [follow, setFollow] = React.useState(false);

  // Follow the pointer only where there is one, and only if motion is welcome.
  React.useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setFollow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The stack glides after the pointer instead of sticking to it.
  React.useEffect(() => {
    if (!follow) return;
    const list = listRef.current;
    const stack = stackRef.current;
    if (!list || !stack) return;

    const target = { x: 0, y: 0 };
    const at = { x: 0, y: 0 };
    let frame = 0;
    let primed = false;

    const tick = () => {
      at.x += (target.x - at.x) * 0.16;
      at.y += (target.y - at.y) * 0.16;
      const tilt = Math.max(-8, Math.min(8, (target.x - at.x) * 0.06));
      stack.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) rotate(${tilt}deg)`;
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = list.getBoundingClientRect();
      target.x = event.clientX - rect.left;
      target.y = event.clientY - rect.top;
      if (!primed) {
        at.x = target.x;
        at.y = target.y;
        primed = true;
      }
    };

    list.addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      list.removeEventListener("pointermove", onMove);
    };
  }, [follow]);

  return (
    <div className="relative">
      <ul ref={listRef} className="relative border-t border-line" onPointerLeave={() => setActive(null)}>
        {rows.map((row, index) => {
          const dimmed = active !== null && active !== index;
          return (
            <li key={row.slug} className="border-b border-line">
              <Link
                href={row.href}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-4 outline-offset-4 sm:py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_8rem]"
              >
                <span
                  className={cn(
                    "font-display text-[clamp(1.9rem,5.2vw,4.4rem)] leading-[0.95] font-extrabold tracking-[-0.045em] transition-[color,opacity,transform] duration-300 ease-[var(--ease-out-quart)]",
                    dimmed ? "text-ink opacity-25" : "text-ink",
                    active === index && "translate-x-2 text-accent sm:translate-x-4",
                  )}
                >
                  {row.label}
                  <sup className="ml-2 align-super font-mono text-[0.26em] font-medium tracking-normal text-muted tabular-nums">
                    {row.count}
                  </sup>
                </span>

                <span
                  className={cn(
                    "hidden text-[13.5px] leading-snug text-ink-3 transition-opacity duration-300 md:block",
                    dimmed && "opacity-30",
                  )}
                >
                  {row.description}
                </span>

                <span
                  className={cn(
                    "text-right font-mono text-[12.5px] whitespace-nowrap text-ink-2 tabular-nums transition-opacity duration-300",
                    dimmed && "opacity-30",
                  )}
                >
                  {row.meta}
                </span>
              </Link>
            </li>
          );
        })}

        {follow && (
          <div
            ref={stackRef}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 z-10 will-change-transform"
            style={{ transform: "translate3d(-999px,-999px,0)" }}
          >
            {rows.map((row, index) => (
              <div
                key={row.slug}
                className={cn(
                  "absolute top-0 left-0 transition-opacity duration-200",
                  active === index ? "opacity-100" : "opacity-0",
                )}
              >
                {row.covers.slice(0, 3).map((slug, layer) => (
                  <div
                    key={slug}
                    className={cn(
                      "absolute h-[118px] w-[210px] overflow-hidden rounded-md border border-white/10 bg-ground shadow-xl",
                      "transition-transform duration-500 ease-[var(--ease-out-quart)]",
                    )}
                    style={{
                      transform:
                        active === index
                          ? `translate(${36 + layer * 26}px, ${-150 + layer * 22}px) rotate(${(layer - 1) * 7}deg)`
                          : `translate(36px, -130px) rotate(0deg) scale(0.9)`,
                      zIndex: 3 - layer,
                    }}
                  >
                    <Image src={`/covers/shelf/${slug}.jpg`} alt="" fill sizes="210px" className="object-cover" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ul>
    </div>
  );
}
