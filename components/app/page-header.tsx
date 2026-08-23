import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared heading block for every private-area screen. */
export function AppPage({
  eyebrow,
  title,
  body,
  action,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10", className)}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
          <h1 className="text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.04] tracking-[-0.035em]">{title}</h1>
          {body && <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{body}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
