"use client";

import * as React from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { cn, clamp, initials as toInitials } from "@/lib/utils";

/* -------------------------------------------------------------------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden className={cn("skeleton", className)} />;
}

/** Text-shaped placeholder: last line is short, the way real paragraphs end. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-3.5", index === lines - 1 ? "w-2/5" : "w-full")} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-3 font-medium text-ink-2",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden={undefined}
    >
      {showImage ? (
        <Image src={src} alt={name} width={size} height={size} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{toInitials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  label,
  size = "md",
  tone = "accent",
  className,
}: {
  value: number;
  label?: string;
  size?: "sm" | "md";
  tone?: "accent" | "success";
  className?: string;
}) {
  const pct = clamp(Math.round(value), 0, 100);
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-ink-3">{label}</span>
          <span className="font-mono text-[12px] tabular-nums text-ink-2">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1" : "h-1.5")}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quart)]",
            tone === "success" ? "bg-success" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Circular variant for the dashboard, where the number is the hero. */
export function ProgressRing({
  value,
  size = 88,
  stroke = 6,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const pct = clamp(value, 0, 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(pct)}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-out-quart)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((step) => {
          const filled = rounded >= step;
          const half = !filled && rounded >= step - 0.5;
          return (
            <span key={step} className="relative inline-flex" style={{ width: size, height: size }}>
              <Star className="absolute inset-0 text-line-3" style={{ width: size, height: size }} strokeWidth={1.5} />
              {(filled || half) && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: half ? size / 2 : size }}>
                  <Star
                    className="text-accent"
                    style={{ width: size, height: size }}
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-ink-2">{value.toFixed(1)}</span>
      {typeof count === "number" && <span className="text-[12px] text-faint">({count})</span>}
      <span className="sr-only">{`${value.toFixed(1)} из 5`}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** Counts up once, when it first scrolls into view. Respects reduced motion. */
export function AnimatedNumber({
  value,
  duration = 900,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = React.useState(0);
  const done = React.useRef(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || done.current) return;
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 4);
          setDisplay(value * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  const rendered = format ? format(display) : Math.round(display).toString();

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {rendered}
    </span>
  );
}
