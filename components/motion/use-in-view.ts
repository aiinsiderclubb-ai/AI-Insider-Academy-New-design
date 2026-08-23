"use client";

import * as React from "react";

/**
 * "Has this scrolled into view yet?"
 *
 * One implementation of the tricky part, shared by every motion primitive.
 * The observer's first callback runs before images and fonts settle, so an
 * element that ends up above the fold can be reported as out of view and then
 * never re-reported — a pure layout shift does not always re-fire it. The
 * manual check after the first frame and after `load` closes that gap without
 * waiting for a scroll.
 *
 * Reduced motion resolves to `true` immediately: nothing may stay hidden.
 */
export function useInView<T extends HTMLElement>(options?: {
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
}) {
  const { once = true, threshold = 0.08, rootMargin = "0px 0px -12% 0px" } = options ?? {};
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);

    const check = () => {
      const box = node.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.94 && box.bottom > 0) {
        setInView(true);
        if (once) observer.unobserve(node);
      }
    };

    const frame = requestAnimationFrame(check);
    const late = window.setTimeout(check, 400);
    window.addEventListener("load", check);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(late);
      window.removeEventListener("load", check);
      observer.disconnect();
    };
  }, [once, threshold, rootMargin]);

  return [ref, inView] as const;
}

/** True once the pointer is a real pointer and motion is welcome. */
export function useFinePointer() {
  const [fine, setFine] = React.useState(false);

  React.useEffect(() => {
    const ok =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFine(ok);
  }, []);

  return fine;
}
