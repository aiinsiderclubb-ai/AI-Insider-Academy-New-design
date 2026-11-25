"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A live HH:MM:SS countdown to `endsAt`. Renders the server's moment first
 * and ticks once mounted, so the markup matches on hydration.
 */
export function Countdown({
  endsAt,
  serverNow,
  className,
  cellClassName,
  labels = ["ч", "мин", "сек"],
}: {
  endsAt: string;
  /** The moment the server rendered at, so the first paint matches. */
  serverNow: number;
  className?: string;
  cellClassName?: string;
  labels?: [string, string, string];
}) {
  const end = Date.parse(endsAt);
  const [now, setNow] = React.useState(serverNow);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = parts(end - now);
  const cells: [number, string][] = [
    [left.hours, labels[0]],
    [left.minutes, labels[1]],
    [left.seconds, labels[2]],
  ];

  return (
    <span className={cn("inline-flex items-end gap-1.5 font-mono tabular-nums", className)} role="timer" aria-live="off">
      {cells.map(([value, label], index) => (
        <React.Fragment key={label}>
          {index > 0 && <span className="pb-3 opacity-50">:</span>}
          <span className={cn("flex flex-col items-center", cellClassName)}>
            <span className="text-[22px] leading-none font-semibold">{pad(value)}</span>
            <span className="mt-1 text-[9.5px] tracking-[0.14em] uppercase opacity-60">{label}</span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}
