"use client";

import * as React from "react";
import { useInView } from "./use-in-view";
import { cn } from "@/lib/utils";

/**
 * A frame that opens instead of fading in.
 *
 * Used on the one image a section is built around; a page full of wiping
 * frames would be a slideshow, not a page.
 *
 * The observer watches the outer element and the clip lives on the inner one.
 * An IntersectionObserver takes clipping into account, so an element hidden by
 * `clip-path` reports an empty intersection rect — watching itself, the frame
 * would wait forever for the moment it is already in.
 */
export function Wipe({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className={cn(className)}>
      <div
        data-wipe={inView ? "shown" : ""}
        style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
        className="h-full w-full"
      >
        {children}
      </div>
    </div>
  );
}
