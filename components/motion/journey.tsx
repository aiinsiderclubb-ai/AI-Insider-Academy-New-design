"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Where the sticky rail sits: 64px of header plus half its own 44px row. */
const RAIL_LINE = 86;

export interface JourneyStop {
  /** Matches the `id` of the section on the page. */
  id: string;
  /** Short caption shown in the floating chip. */
  label: string;
}

/**
 * The page as a route.
 *
 * A hairline rail across the top fills with scroll progress and names the two
 * ends of the journey; a chip in the corner says which stop you are at. Both
 * read the same observer, so they can never disagree.
 */
export function Journey({
  stops,
  from,
  to,
  railUntil,
  className,
}: {
  stops: JourneyStop[];
  from: string;
  to: string;
  /**
   * Id of the first section the rail must not reach. Chapters carry their own
   * ground and their own headings; a hairline and two labels drawn across them
   * read as a rendering fault, so the rail retires and the chip carries on.
   */
  railUntil?: string;
  className?: string;
}) {
  const [progress, setProgress] = React.useState(0);
  const [active, setActive] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const [railOn, setRailOn] = React.useState(true);
  const [overDark, setOverDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const nodes = stops
      .map((stop) => document.getElementById(stop.id))
      .filter((node): node is HTMLElement => Boolean(node));

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      // Hide once the footer is in play: the route has already been travelled.
      setVisible(window.scrollY > 120 && window.scrollY < max - window.innerHeight * 0.4);

      const limit = railUntil ? document.getElementById(railUntil) : null;
      setRailOn(!limit || limit.getBoundingClientRect().top > 140);

      // In light mode the rail's own tokens are tuned for paper, and the
      // opening frame is a dark photograph in both themes — so while the rail
      // sits over it, it borrows the dark ground the same way the header does.
      const frame = document.querySelector("[data-dark-hero]");
      setOverDark(Boolean(frame) && frame!.getBoundingClientRect().bottom > RAIL_LINE);

      // The active stop is the last one whose top has passed the upper third.
      const line = window.innerHeight * 0.34;
      let current = 0;
      nodes.forEach((node, index) => {
        if (node.getBoundingClientRect().top <= line) current = index;
      });
      setActive(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [stops, railUntil]);

  const stop = stops[active];
  const total = String(stops.length).padStart(3, "0");
  const index = String(active + 1).padStart(3, "0");

  // Rendered into the body, not into the page.
  //
  // Two problems disappear at once. In flow, the rail was a 44px row cancelled
  // by `-mb-11`, and that negative margin sat beside the hero's own `-mt-16`:
  // adjacent negative margins collapse to the largest one alone, so the
  // `-mb-11` was quietly dropped and the opening frame landed 44px low. That
  // left a strip of page ground behind the transparent header — invisible on a
  // near-black ground, glaring on paper. And a `position: fixed` descendant of
  // the page-transition wrapper is positioned against that wrapper for as long
  // as its transform animation runs, which is the trap `globals.css` warns
  // about next to `.animate-page`.
  //
  // The body is neither in the page's margin chain nor transformed, so both
  // pieces here sit where they say they do. Nothing renders until mount; these
  // are decorations driven entirely by scroll, and they have nothing to say
  // before there is a scroll position to read.
  if (!mounted) return null;

  return createPortal(
    <>
      {/* ------------------------------ top rail ------------------------------ */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-16 z-30 hidden transition-opacity duration-300 md:block",
          railOn ? "opacity-100" : "opacity-0",
          overDark && "on-dark",
          className,
        )}
        aria-hidden
      >
        <div className="flex h-11 items-center gap-4 px-5 sm:px-7">
          <span className="font-mono text-2xs tracking-[0.22em] text-faint uppercase">{from}</span>

          <span className="relative h-px flex-1 overflow-hidden bg-line">
            <span
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-150 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
            <span
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-150 ease-out"
              style={{ left: `${progress * 100}%` }}
            />
          </span>

          <span className="font-mono text-2xs tracking-[0.22em] text-faint uppercase">{to}</span>
          <span className="font-mono text-2xs tracking-[0.16em] tabular-nums text-muted">
            {index} / {total}
          </span>
        </div>
      </div>

      {/* ------------------------------ stop chip ----------------------------- */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed right-4 bottom-4 z-40 hidden transition-[opacity,transform] duration-300 ease-[var(--ease-out-quart)] sm:block",
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <span className="flex items-center gap-2.5 rounded-full border border-line-2 bg-[color-mix(in_oklab,var(--surface)_86%,transparent)] py-2 pr-4 pl-2 shadow-pop backdrop-blur-xl">
          <span className="flex h-6 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[10px] tabular-nums text-on-accent">
            {String(active + 1).padStart(2, "0")}
          </span>
          <span className="font-mono text-2xs tracking-[0.14em] text-ink-2 uppercase">{stop?.label}</span>
        </span>
      </div>
    </>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */

/** "Scroll to travel" — the cue that the page rewards scrolling. */
export function ScrollHint({ label }: { label: string }) {
  return (
    <div className="pointer-events-none flex items-center justify-center gap-3" aria-hidden>
      <span className="h-px w-10 bg-line-2" />
      <span className="font-mono text-2xs tracking-[0.22em] text-faint uppercase">{label}</span>
      <span className="animate-bob font-mono text-2xs text-accent">↓</span>
      <span className="h-px w-10 bg-line-2" />
    </div>
  );
}
