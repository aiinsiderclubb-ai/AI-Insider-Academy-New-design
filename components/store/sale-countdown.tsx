"use client";

import * as React from "react";

/** Hours, minutes and seconds left until `endsAt`, ticking. Rendered after mount so server and client agree. */
export function SaleCountdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const [left, setLeft] = React.useState<number | null>(null);
  React.useEffect(() => {
    const end = Date.parse(endsAt);
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (left === null) return <span className={className}>--:--:--</span>;
  const total = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className={className} suppressHydrationWarning>
      {pad(Math.floor(total / 3600))}:{pad(Math.floor((total % 3600) / 60))}:{pad(total % 60)}
    </span>
  );
}
