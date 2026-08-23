import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A stat tile answers one question. The number is the hero, the label sits
 * under it, and any delta is encoded in both colour and sign.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "good" | "warning";
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-5", className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "mt-3 font-display text-[clamp(1.6rem,2.6vw,2.25rem)] leading-none font-extrabold tracking-tight tabular-nums",
          tone === "good" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[12.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/** A queue card: how many items wait, and one click to act on them. */
export function QueueTile({
  label,
  count,
  href,
  note,
}: {
  label: string;
  count: number;
  href: string;
  note: string;
}) {
  const idle = count === 0;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start justify-between gap-4 rounded-lg border p-5 transition-[transform,box-shadow,border-color] duration-200",
        idle
          ? "border-line bg-surface hover:border-line-2"
          : "border-accent/45 bg-accent-soft hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <span className="min-w-0">
        <span className="eyebrow block">{label}</span>
        <span
          className={cn(
            "mt-3 block font-display text-[2rem] leading-none font-extrabold tabular-nums",
            idle ? "text-ink-3" : "text-ink",
          )}
        >
          {count}
        </span>
        <span className="mt-2 block text-[12.5px] leading-snug text-muted">{note}</span>
      </span>
      <ArrowUpRight
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
          idle ? "text-line-3" : "text-accent-ink",
        )}
        aria-hidden
      />
    </Link>
  );
}

/** Dense table shell used across the Studio. */
export function DataTable({
  columns,
  children,
  caption,
  empty,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  children: React.ReactNode;
  caption: string;
  empty?: React.ReactNode;
}) {
  const hasRows = React.Children.count(children) > 0;
  return (
    <div className="scroll-x rounded-lg border border-line bg-surface">
      {hasRows ? (
        <table className="w-full min-w-[40rem] text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 font-mono text-2xs tracking-[0.1em] text-muted uppercase",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      ) : (
        <div className="px-5 py-10 text-center text-[13.5px] text-muted">{empty}</div>
      )}
    </div>
  );
}

export function Cell({
  children,
  align = "left",
  mono,
  strong,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5 align-top",
        align === "right" ? "text-right" : "text-left",
        mono && "font-mono tabular-nums",
        strong ? "font-medium text-ink" : "text-ink-2",
      )}
    >
      {children}
    </td>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2">{children}</tr>;
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[15px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
