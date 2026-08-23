"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The action, kept within reach.
 *
 * It arrives once the opener has scrolled away and steps back out while the
 * pricing chapter is on screen — two identical buttons competing in the same
 * viewport is the kind of clutter this page is trying to lose.
 */
export function CourseBar({
  title,
  price,
  note,
  href,
  cta,
  watchId = "access",
}: {
  title: string;
  price: string;
  note?: string;
  href: string;
  cta: string;
  /** Element whose presence on screen hides the bar. */
  watchId?: string;
}) {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    let atAccess = false;

    const target = document.getElementById(watchId);
    let observer: IntersectionObserver | null = null;
    if (target) {
      observer = new IntersectionObserver(
        ([entry]) => {
          atAccess = entry.isIntersecting;
          onScroll();
        },
        { rootMargin: "-20% 0px -20% 0px" },
      );
      observer.observe(target);
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const past = window.scrollY > window.innerHeight * 0.7;
      const beforeFooter = window.scrollY < max - window.innerHeight * 0.25;
      setShown(past && beforeFooter && !atAccess);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer?.disconnect();
    };
  }, [watchId]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-xl",
        "transition-[transform,opacity] duration-400 ease-[var(--ease-out-quart)]",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-5 px-5 py-3 sm:px-7">
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate text-[14px] font-medium text-ink">{title}</p>
          {note && <p className="truncate text-[12.5px] text-muted">{note}</p>}
        </div>

        <p className="flex flex-1 items-baseline gap-2 sm:flex-none">
          <span className="font-display text-[1.35rem] leading-none font-extrabold tracking-tight tabular-nums text-ink">
            {price}
          </span>
        </p>

        <Link
          href={href}
          className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-6 text-[14.5px] font-medium text-on-accent transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-accent-strong hover:shadow-glow"
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
