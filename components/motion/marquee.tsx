import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Endless ribbon of short labels.
 *
 * The list is rendered twice so the loop is seamless; the duplicate is hidden
 * from assistive tech and the copy is never read out twice.
 */
export function Marquee({
  items,
  duration = 38,
  className,
  separator = "●",
}: {
  items: string[];
  /** Seconds for one full pass. */
  duration?: number;
  className?: string;
  separator?: string;
}) {
  if (!items.length) return null;

  const strip = (hidden: boolean) => (
    <ul
      className="flex shrink-0 items-center gap-8 pr-8"
      aria-hidden={hidden || undefined}
    >
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-center gap-8 whitespace-nowrap">
          <span className="font-mono text-[12px] tracking-[0.18em] text-ink-3 uppercase">{item}</span>
          <span className="text-[8px] text-accent" aria-hidden>
            {separator}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        "marquee relative flex overflow-hidden border-y border-line py-4",
        "[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      <div className="marquee-track flex" style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}>
        {strip(false)}
        {strip(true)}
      </div>
    </div>
  );
}
