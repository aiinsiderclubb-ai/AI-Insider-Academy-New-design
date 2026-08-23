"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A vertical hairline that fills as its section passes the reader.
 *
 * It measures the element it is placed inside, so the caller only has to give
 * it a positioned parent. Progress runs from the moment the section's top
 * reaches the lower third of the viewport to the moment its bottom clears the
 * upper third — the stretch during which someone is actually reading it.
 */
export function ScrollRail({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    const host = node?.parentElement;
    if (!node || !host) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const box = host.getBoundingClientRect();
      const start = window.innerHeight * 0.72;
      const end = window.innerHeight * 0.28;
      const travelled = start - box.top;
      const total = box.height - (start - end);
      setProgress(total > 0 ? Math.min(1, Math.max(0, travelled / total)) : box.top < start ? 1 : 0);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div aria-hidden className={cn("absolute top-0 bottom-0 w-px bg-line", className)} ref={ref}>
      <span
        className="absolute inset-x-0 top-0 block bg-accent transition-[height] duration-100 ease-linear"
        style={{ height: `${progress * 100}%` }}
      />
      <span
        className="absolute -left-[3px] block h-[7px] w-[7px] rounded-full bg-accent shadow-glow transition-[top] duration-100 ease-linear"
        style={{ top: `calc(${progress * 100}% - 3px)` }}
      />
    </div>
  );
}
