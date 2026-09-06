"use client";

import * as React from "react";
import { formatNumber, formatPrice } from "@/lib/i18n";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export interface Point {
  date: string;
  value: number;
}

export type ChartFormat = "number" | "price";

function chartValue(value: number, locale: Locale, format: ChartFormat) {
  return format === "price" ? formatPrice(Math.round(value), locale) : formatNumber(Math.round(value), locale);
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function useHover(points: Point[], width: number, padding: number) {
  const [index, setIndex] = React.useState<number | null>(null);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const inner = width - padding * 2;
    const step = points.length > 1 ? inner / (points.length - 1) : inner;
    const nearest = Math.round((x - padding) / step);
    setIndex(Math.min(points.length - 1, Math.max(0, nearest)));
  };

  return { index, onMove, onLeave: () => setIndex(null) };
}

/* ================================ sparkline ================================ */

/**
 * One series over time. No legend — the title names it. The endpoint is
 * emphasised because "where are we now" is the question a pulse chart answers.
 */
export function Sparkline({
  points,
  height = 120,
  format = "number",
  locale = defaultLocale,
  label,
  className,
}: {
  points: Point[];
  height?: number;
  format?: ChartFormat;
  locale?: Locale;
  label: string;
  className?: string;
}) {
  const width = 640;
  const padding = 8;
  const { index, onMove, onLeave } = useHover(points, width, padding);

  if (points.length < 2) {
    return (
      <div className={cn("flex h-[120px] items-center justify-center rounded-md bg-surface-2", className)}>
        <p className="text-[12.5px] text-muted">{label}</p>
      </div>
    );
  }

  const max = niceMax(Math.max(...points.map((point) => point.value)));
  const inner = width - padding * 2;
  const step = inner / (points.length - 1);
  const y = (value: number) => height - padding - (value / max) * (height - padding * 2);

  const line = points.map((point, i) => `${padding + i * step},${y(point.value)}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${padding + inner},${height - padding}`;
  const active = index !== null ? points[index] : null;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {/* recessive baseline grid */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            x2={width - padding}
            y1={y(max * ratio)}
            y2={y(max * ratio)}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}

        <polygon points={area} fill="var(--accent)" opacity="0.1" />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* the endpoint carries the current value */}
        <circle
          cx={padding + (points.length - 1) * step}
          cy={y(points[points.length - 1].value)}
          r="4"
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth="2"
        />

        {active && index !== null && (
          <>
            <line
              x1={padding + index * step}
              x2={padding + index * step}
              y1={padding}
              y2={height - padding}
              stroke="var(--line-3)"
              strokeWidth="1"
            />
            <circle
              cx={padding + index * step}
              cy={y(active.value)}
              r="4"
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: `${((padding + (index ?? 0) * step) / width) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-mono text-[11px] text-muted">{active.date}</p>
          <p className="font-mono text-[13px] font-medium tabular-nums text-ink">{chartValue(active.value, locale, format)}</p>
        </div>
      )}
    </div>
  );
}

/* =================================== bars ================================== */

export function Bars({
  points,
  height = 140,
  format = "number",
  locale = defaultLocale,
  label,
  className,
}: {
  points: Point[];
  height?: number;
  format?: ChartFormat;
  locale?: Locale;
  label: string;
  className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);

  if (!points.length) {
    return (
      <div className={cn("flex items-center justify-center rounded-md bg-surface-2", className)} style={{ height }}>
        <p className="text-[12.5px] text-muted">{label}</p>
      </div>
    );
  }

  const max = niceMax(Math.max(...points.map((point) => point.value)));

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label={label}>
        {points.map((point, index) => (
          <div
            key={point.date}
            className="group relative flex-1"
            style={{ height: "100%" }}
            onPointerEnter={() => setHover(index)}
            onPointerLeave={() => setHover(null)}
          >
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 rounded-t-[4px] transition-colors",
                hover === index ? "bg-accent" : "bg-accent/55",
              )}
              style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: `${((hover + 0.5) / points.length) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-mono text-[11px] text-muted">{points[hover].date}</p>
          <p className="font-mono text-[13px] font-medium tabular-nums text-ink">{chartValue(points[hover].value, locale, format)}</p>
        </div>
      )}
    </div>
  );
}

/* ============================== ranked rows ================================ */

/** Horizontal magnitude comparison — the honest form for "top N by count". */
export function RankedBars({
  rows,
  format = "number",
  locale = defaultLocale,
  className,
}: {
  rows: { label: string; value: number }[];
  format?: ChartFormat;
  locale?: Locale;
  className?: string;
}) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((row) => row.value)) || 1;

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-ink-2">{row.label}</span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
              />
            </span>
          </span>
          <span className="font-mono text-[12.5px] tabular-nums text-ink-2">{chartValue(row.value, locale, format)}</span>
        </li>
      ))}
    </ul>
  );
}
