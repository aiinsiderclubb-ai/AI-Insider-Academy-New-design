"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Moves its child against the scroll.
 *
 * The child is scaled up by exactly the amount it will travel, so the frame
 * never runs out of image at either end. Work happens inside one rAF tick and
 * only while the element is on screen.
 */
export function Parallax({
  children,
  /** Share of the element's height it drifts across a full pass. 0.12 is a hint; 0.3 is obvious. */
  speed = 0.14,
  className,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const hostNode = host.current;
    const innerNode = inner.current;
    if (!hostNode || !innerNode) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let visible = true;

    const apply = () => {
      frame = 0;
      if (!visible) return;
      const box = hostNode.getBoundingClientRect();
      // -1 when the element sits below the fold, +1 once it has passed above.
      const progress = (box.top + box.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2 + box.height / 2);
      innerNode.style.transform = `translate3d(0, ${(progress * speed * box.height).toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) onScroll();
      },
      { rootMargin: "20% 0px" },
    );
    observer.observe(hostNode);

    innerNode.style.scale = String(1 + speed);
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
      innerNode.style.transform = "";
      innerNode.style.scale = "";
    };
  }, [speed]);

  return (
    <div ref={host} className={cn("relative overflow-hidden", className)}>
      <div ref={inner} className="absolute inset-0 will-change-transform">
        {children}
      </div>
    </div>
  );
}
