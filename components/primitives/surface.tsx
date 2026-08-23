import * as React from "react";
import { Headline } from "@/components/motion/headline";
import { cn } from "@/lib/utils";

/**
 * Card is the workhorse surface. `interactive` adds the lift used on anything
 * the whole card links to; static cards stay flat so hover means "clickable".
 */
export function Card({
  className,
  interactive,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; inset?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-line bg-surface shadow-xs",
        inset && "p-5 sm:p-6",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)] " +
            "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md",
        className,
      )}
    />
  );
}

/** A quieter container for grouped controls and sidebars. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("rounded-xl border border-line bg-surface-2 p-5", className)} />;
}

export function Divider({
  className,
  label,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { label?: string }) {
  if (!label) return <hr {...props} className={cn("my-8 border-line", className)} />;
  return (
    <div {...props} className={cn("my-8 flex items-center gap-3", className)}>
      <hr className="flex-1 border-line" />
      <span className="eyebrow">{label}</span>
      <hr className="flex-1 border-line" />
    </div>
  );
}

/**
 * Section heading with an optional monospaced eyebrow and trailing action.
 *
 * A plain-string title is typeset word by word as it comes into view; a rich
 * title is rendered as given, since only the caller knows where its pieces
 * may be split.
 */
export function SectionHead({
  eyebrow,
  title,
  body,
  action,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const size = Tag === "h1" ? "text-[clamp(2rem,4.6vw,3.25rem)]" : "text-[clamp(1.5rem,3vw,2.25rem)]";

  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <p className="eyebrow mb-3 flex items-center gap-3">
            <span className="rule-accent inline-block w-7" aria-hidden />
            {eyebrow}
          </p>
        )}
        {typeof title === "string" ? (
          <Headline as={Tag} text={title} step={55} className={size} />
        ) : (
          <Tag className={size}>{title}</Tag>
        )}
        {body && <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{body}</p>}
      </div>
      {action}
    </div>
  );
}

/** Page-width wrapper. `wide` is for catalogue grids, `narrow` for reading. */
export function Container({
  className,
  size = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: "narrow" | "default" | "wide" }) {
  return (
    <div
      {...props}
      className={cn(
        "mx-auto w-full px-5 sm:px-7",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-[1440px]",
        className,
      )}
    />
  );
}
