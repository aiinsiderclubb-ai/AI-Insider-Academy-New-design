"use client";

import * as React from "react";
import { useInView } from "./use-in-view";
import { cn } from "@/lib/utils";

type Tag = "h1" | "h2" | "h3" | "p" | "div";

/**
 * A headline that arrives a piece at a time.
 *
 * Each piece rides up out of its own mask, so the type looks typeset rather
 * than faded in. Pass `lines` for copy you control — the mask is then the
 * whole line and a marker highlight stays intact. Pass `text` for a dynamic
 * title, where the line breaks depend on the viewport: the split falls back
 * to words, which wrap naturally and still read as one movement.
 */
export function Headline({
  lines,
  text,
  as: Tag = "h2",
  step = 90,
  delay = 0,
  className,
  id,
}: {
  lines?: React.ReactNode[];
  text?: string;
  as?: Tag;
  /** Milliseconds between pieces. */
  step?: number;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const [ref, inView] = useInView<HTMLHeadingElement>();
  const pieces = lines ?? (text ?? "").split(" ");
  const perLine = Boolean(lines);

  return (
    <Tag id={id} ref={ref as React.Ref<HTMLHeadingElement>} className={cn(className)}>
      {pieces.map((piece, index) => (
        <React.Fragment key={index}>
          <span
            data-line={inView ? "shown" : ""}
            data-split={perLine ? "line" : "word"}
            style={{ "--line-delay": `${delay + index * step}ms` } as React.CSSProperties}
          >
            <span>{piece}</span>
          </span>
          {/* Words need the space back — a masked span swallows it. */}
          {!perLine && index < pieces.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </Tag>
  );
}
