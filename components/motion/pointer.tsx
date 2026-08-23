"use client";

import * as React from "react";
import { useFinePointer } from "./use-in-view";
import { cn } from "@/lib/utils";

/**
 * Warms a dark chapter where the cursor is.
 *
 * The gradient itself lives in CSS (`.spot`); this only feeds it coordinates,
 * and only on a device with a real pointer — on touch there is no cursor to
 * follow and the listener would be pure cost.
 */
export function Spotlight({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const ref = React.useRef<HTMLElement>(null);
  const fine = useFinePointer();

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !fine) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      frame = 0;
      node.style.setProperty("--mx", `${x}px`);
      node.style.setProperty("--my", `${y}px`);
    };

    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      x = event.clientX - box.left;
      y = event.clientY - box.top;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    node.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
    };
  }, [fine]);

  return React.createElement(
    Tag,
    { ref, className: cn(fine && "spot", className) },
    children,
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A control that leans toward the cursor as it approaches.
 *
 * Only the wrapper moves, so the button keeps its own hover and focus states.
 * Touch devices get a plain wrapper — a magnet with no pointer is just a div.
 */
export function Magnetic({
  children,
  /** Maximum pull in pixels. */
  strength = 7,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const fine = useFinePointer();

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !fine) return;

    let frame = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      frame = 0;
      node.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    };

    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      tx = ((event.clientX - (box.left + box.width / 2)) / (box.width / 2)) * strength;
      ty = ((event.clientY - (box.top + box.height / 2)) / (box.height / 2)) * strength;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      node.style.transform = "";
    };
  }, [fine, strength]);

  return (
    <span
      ref={ref}
      className={cn("inline-flex transition-transform duration-500 ease-[var(--ease-out-expo)]", className)}
    >
      {children}
    </span>
  );
}
