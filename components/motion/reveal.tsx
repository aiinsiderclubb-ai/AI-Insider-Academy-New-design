"use client";

import * as React from "react";
import { useInView } from "./use-in-view";
import { cn } from "@/lib/utils";

type Element =
  | "div"
  | "section"
  | "li"
  | "ul"
  | "ol"
  | "dl"
  | "article"
  | "span"
  | "p"
  | "header"
  | "figure";

/**
 * Releases its children when they scroll into view.
 *
 * The hidden state lives in CSS (`[data-reveal]`), so the markup is complete in
 * the HTML and only the flip to `shown` is scripted — nothing stays invisible
 * if JavaScript is slow, and `prefers-reduced-motion` skips the transition
 * entirely. `useInView` carries the observer quirks.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  distance = 16,
  once = true,
  className,
  ...props
}: {
  children: React.ReactNode;
  as?: Element;
  /** Milliseconds; use in steps of ~60 to stagger a row. */
  delay?: number;
  distance?: number;
  once?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  const [ref, inView] = useInView<HTMLElement>({ once });

  return React.createElement(
    Tag,
    {
      ref,
      "data-reveal": inView ? "shown" : "",
      style: {
        "--reveal-delay": `${delay}ms`,
        "--reveal-y": `${distance}px`,
        ...props.style,
      } as React.CSSProperties,
      className: cn(className),
      ...props,
    },
    children,
  );
}

/**
 * Staggers the direct children of a grid or list.
 *
 * Each child gets its own wrapper, which becomes the grid item — cards inside
 * carry `h-full` so a stretched row still lines up.
 */
export function RevealGroup({
  children,
  step = 60,
  maxSteps = 6,
  as: Tag = "div",
  itemAs = "div",
  distance = 16,
  className,
  ...props
}: {
  children: React.ReactNode;
  step?: number;
  /** Caps the cascade so a long grid never ends on a two-second delay. */
  maxSteps?: number;
  as?: Element;
  itemAs?: Element;
  distance?: number;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  const items = React.Children.toArray(children);

  return React.createElement(
    Tag,
    { className: cn(className), ...props },
    items.map((child, index) => (
      <Reveal key={index} as={itemAs} delay={Math.min(index, maxSteps) * step} distance={distance} className="min-w-0">
        {child}
      </Reveal>
    )),
  );
}
