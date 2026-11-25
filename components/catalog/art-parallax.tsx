"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lets a card's artwork follow the pointer: the picture drifts a few pixels
 * against the cursor, tilts slightly and catches a soft light where the
 * pointer is, so the objects in it seem to move. It listens on the whole card
 * (the closest <article>), eases back to rest when the pointer leaves, and
 * stays still for anyone who asks for reduced motion or uses touch.
 */
export function ArtParallax({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const frame = ref.current;
    const card = frame?.closest("article") ?? frame;
    if (!frame || !card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let raf = 0;
    const set = (x: number, y: number, active: boolean) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        frame.style.setProperty("--art-x", x.toFixed(3));
        frame.style.setProperty("--art-y", y.toFixed(3));
        frame.dataset.active = active ? "true" : "false";
      });
    };
    const move = (event: PointerEvent) => {
      const box = frame.getBoundingClientRect();
      // -1…1 across the artwork, clamped when the pointer is on the card below it.
      const x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
      set(x, y, true);
    };
    const leave = () => set(0, 0, false);

    card.addEventListener("pointermove", move as EventListener);
    card.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", move as EventListener);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={ref} data-active="false" className={cn("art-parallax", className)}>
      {/* everything drawn on the art (and anything pinned to it) moves as one layer */}
      <div className="art-parallax-layer">{children}</div>
      <span aria-hidden className="art-parallax-glare" />
    </div>
  );
}
