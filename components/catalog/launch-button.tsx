"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SPARKS = 14;
/** Long enough for the burst to read, short enough not to feel like a wait. */
const LAUNCH_MS = 620;

type Spark = { dx: number; dy: number; delay: number; size: number };

function burst(): Spark[] {
  return Array.from({ length: SPARKS }, (_, i) => {
    const angle = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.35;
    const reach = 46 + Math.random() * 38;
    return {
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach * 0.72,
      delay: Math.random() * 60,
      size: 3 + Math.random() * 4,
    };
  });
}

/**
 * The call to action that starts a free course.
 *
 * A click lights the button up: a ripple spreads from the point of the click,
 * sparks fly off, the arrow shoots out and the label rolls over to "opening",
 * then the page moves on. A modified click (new tab) and reduced motion skip
 * the show and behave like a plain link.
 */
export function LaunchButton({
  href,
  label,
  pendingLabel,
  className,
}: {
  href: string;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [launch, setLaunch] = React.useState<{ x: number; y: number; sparks: Spark[] } | null>(null);
  const timer = React.useRef<number>(0);

  React.useEffect(() => {
    // Coming back through the history cache must not find the button mid-launch.
    const reset = () => setLaunch(null);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.clearTimeout(timer.current);
    };
  }, []);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    if (launch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Keyboard activation has no pointer position: burst from the middle.
    const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
    const y = event.clientY ? event.clientY - rect.top : rect.height / 2;
    setLaunch({ x, y, sparks: burst() });
    router.prefetch(href);
    timer.current = window.setTimeout(() => router.push(href), LAUNCH_MS);
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      data-launching={launch ? "" : undefined}
      aria-busy={launch ? true : undefined}
      className={cn(
        "launch-btn group relative inline-flex h-14 items-center gap-3 rounded-full bg-accent pr-2 pl-7",
        "text-[15.5px] font-semibold text-on-accent shadow-glow outline-none",
        "transition-[transform,box-shadow,background-color] duration-200 ease-[var(--ease-out-quart)]",
        "hover:-translate-y-0.5 hover:bg-accent-strong focus-visible:ring-4 focus-visible:ring-accent-ring",
        className,
      )}
    >
      {/* clipped layer: hover sheen and the click ripple stay inside the pill */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="launch-sheen absolute inset-y-0 -left-1/2 w-1/2" />
        {launch && (
          <span
            className="launch-ripple absolute h-10 w-10 rounded-full"
            style={{ left: launch.x - 20, top: launch.y - 20 }}
          />
        )}
      </span>

      <span className="relative grid overflow-hidden">
        <span className="launch-label col-start-1 row-start-1">{label}</span>
        <span aria-hidden className="launch-label-next col-start-1 row-start-1">
          {pendingLabel}
        </span>
      </span>

      <span className="launch-orb relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-on-accent text-accent">
        <ArrowRight className="launch-arrow h-[18px] w-[18px]" aria-hidden />
        <ArrowRight className="launch-arrow-next absolute h-[18px] w-[18px]" aria-hidden />
      </span>

      {launch && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {launch.sparks.map((spark, i) => (
            <span
              key={i}
              className="launch-spark absolute rounded-full"
              style={
                {
                  left: launch.x,
                  top: launch.y,
                  width: spark.size,
                  height: spark.size,
                  "--dx": `${spark.dx}px`,
                  "--dy": `${spark.dy}px`,
                  animationDelay: `${spark.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      )}
    </Link>
  );
}
