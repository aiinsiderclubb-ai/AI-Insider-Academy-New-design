import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An empty state is a small landing page: say what will live here, why it
 * matters, and give exactly one thing to do. Never a lone grey sentence.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-line-2 bg-surface-2 text-center",
        compact ? "gap-3 px-6 py-8" : "gap-4 px-6 py-14",
        className,
      )}
    >
      {icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-accent shadow-xs">
          {icon}
        </span>
      )}
      <div className="max-w-sm">
        <p className="font-display text-lg font-extrabold tracking-tight text-ink">{title}</p>
        {body && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{body}</p>}
      </div>
      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-5 py-4",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-danger">{title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** Inline notice for prerequisites, caveats and pricing footnotes. */
export function Note({
  tone = "accent",
  children,
  className,
}: {
  tone?: "accent" | "warning" | "neutral";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-r-md border-l-[3px] px-4 py-3 text-[13.5px] leading-relaxed",
        tone === "accent" && "border-accent bg-accent-soft text-ink-2",
        tone === "warning" && "border-warning bg-warning-soft text-ink-2",
        tone === "neutral" && "border-line-3 bg-surface-2 text-ink-3",
        className,
      )}
    >
      {children}
    </p>
  );
}
