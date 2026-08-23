import * as React from "react";
import { Headline } from "@/components/motion/headline";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/**
 * The opening of a chapter.
 *
 * A short orange rule, a monospaced label, then the title typeset line by
 * line. The rule is the smallest possible dose of the accent and it repeats
 * down the page, which is what makes the sequence feel like one document.
 */
export function ChapterHead({
  eyebrow,
  lines,
  body,
  action,
  id,
  className,
  as = "h2",
}: {
  eyebrow?: React.ReactNode;
  /** One entry per typeset line — line breaks are a design decision, not an accident. */
  lines: React.ReactNode[];
  body?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-10 gap-y-5", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <Reveal>
            <p className="eyebrow flex items-center gap-3">
              <span className="rule-accent inline-block w-7" aria-hidden />
              {eyebrow}
            </p>
          </Reveal>
        )}
        <Headline
          id={id}
          as={as}
          lines={lines}
          delay={eyebrow ? 80 : 0}
          className={cn(
            "mt-5 tracking-[-0.04em]",
            as === "h1" ? "text-[clamp(2.1rem,5vw,3.5rem)]" : "text-[clamp(1.6rem,3.2vw,2.5rem)]",
          )}
        />
        {body && (
          <Reveal delay={200}>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-3">{body}</p>
          </Reveal>
        )}
      </div>
      {action && <Reveal delay={160}>{action}</Reveal>}
    </div>
  );
}
