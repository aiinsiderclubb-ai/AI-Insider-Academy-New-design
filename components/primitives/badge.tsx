import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-3 border-transparent",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  outline: "bg-transparent text-muted border-line-2",
};

/**
 * Small status marker. Uppercase mono keeps it readable at 11px and stops it
 * competing with the surrounding sentence case.
 */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border px-2 py-1 font-mono text-2xs leading-none tracking-[0.1em] uppercase",
        tones[tone],
        className,
      )}
    />
  );
}

/** Rounded, sentence-case counterpart used for filters and tags. */
const chipClass = (active?: boolean) =>
  cn(
    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium " +
      "transition-[background-color,border-color,color] duration-150",
    active
      ? "border-accent bg-accent text-on-accent"
      : "border-line-2 bg-surface text-ink-2 hover:border-line-3 hover:bg-surface-2",
  );

function ChipCount({ value, active }: { value: number; active?: boolean }) {
  return (
    <span className={cn("font-mono text-2xs tabular-nums", active ? "opacity-80" : "text-faint")}>{value}</span>
  );
}

export function Chip({
  active,
  count,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number }) {
  return (
    <button type="button" aria-pressed={active} {...props} className={cn(chipClass(active), className)}>
      {children}
      {typeof count === "number" && <ChipCount value={count} active={active} />}
    </button>
  );
}

/**
 * Filter chips that navigate rather than toggle local state. A link inside a
 * button is invalid, so the link *is* the chip.
 */
export function ChipLink({
  active,
  count,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  active?: boolean;
  count?: number;
  className?: string;
}) {
  return (
    <Link {...props} aria-current={active ? "page" : undefined} className={cn(chipClass(active), className)}>
      {children}
      {typeof count === "number" && <ChipCount value={count} active={active} />}
    </Link>
  );
}

/** Live/attention dot. Pulses only when it means "right now". */
export function Dot({ tone = "accent", pulse }: { tone?: Tone; pulse?: boolean }) {
  const color =
    tone === "success" ? "bg-success" : tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-accent";
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
      {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

/** Key/value pill for prices, counts and IDs. */
export function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-none font-extrabold tracking-tight text-ink tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-[13px] leading-snug text-muted">{label}</div>
    </div>
  );
}
