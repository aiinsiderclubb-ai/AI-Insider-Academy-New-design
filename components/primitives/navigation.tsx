"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Breadcrumbs
   ========================================================================== */

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, label = "Вы здесь", className }: { items: Crumb[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="truncate transition-colors hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span className={cn("truncate", last && "text-ink-2")} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-line-3" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ==========================================================================
   Tabs — underline style, keyboard arrows, animated indicator
   ========================================================================== */

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].value);
    (listRef.current?.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className={cn("scroll-x no-scrollbar border-b border-line", className)}>
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex min-w-max gap-1">
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative -mb-px flex items-center gap-2 border-b-2 px-3.5 pb-3 text-sm font-medium transition-colors",
                selected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink-2",
              )}
            >
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-2xs tabular-nums",
                    selected ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-faint",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   Accordion — <details> under the hood so it works before hydration
   ========================================================================== */

export function Accordion({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface", className)}>{children}</div>;
}

export function AccordionItem({
  title,
  children,
  defaultOpen,
  name,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Shared name makes the group exclusive, like a real accordion. */
  name?: string;
}) {
  return (
    <details name={name} open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{title}</span>
        <Plus
          className="h-4 w-4 shrink-0 text-faint transition-transform duration-200 ease-[var(--ease-out-quart)] group-open:rotate-45"
          aria-hidden
        />
      </summary>
      <div className="px-5 pb-5 text-[14px] leading-relaxed text-ink-3">{children}</div>
    </details>
  );
}
