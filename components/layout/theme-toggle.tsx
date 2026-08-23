"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aia-theme";

/**
 * Two states, not three.
 *
 * The product is dark by design, so "match system" would only ever mean
 * "sometimes undo the design". Light stays available as a deliberate choice.
 */
export function ThemeToggle({
  labels,
  className,
  triggerClassName,
}: {
  labels: { theme: string; light: string; dark: string; system: string };
  className?: string;
  triggerClassName?: string;
}) {
  const [light, setLight] = React.useState(false);

  React.useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    const root = document.documentElement;
    if (next) {
      root.setAttribute("data-theme", "light");
      localStorage.setItem(STORAGE_KEY, "light");
    } else {
      root.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={light}
      aria-label={`${labels.theme}: ${light ? labels.light : labels.dark}`}
      title={light ? labels.dark : labels.light}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink",
        triggerClassName,
        className,
      )}
    >
      <span className="relative block h-4 w-4">
        <Sun
          className={cn(
            "absolute inset-0 h-4 w-4 transition-[opacity,transform] duration-300 ease-[var(--ease-out-quart)]",
            light ? "rotate-0 opacity-100" : "-rotate-90 opacity-0",
          )}
          aria-hidden
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4 w-4 transition-[opacity,transform] duration-300 ease-[var(--ease-out-quart)]",
            light ? "rotate-90 opacity-0" : "rotate-0 opacity-100",
          )}
          aria-hidden
        />
      </span>
    </button>
  );
}
