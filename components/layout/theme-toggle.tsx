"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aia-theme";

/** Keeps the browser chrome on the same ground as the page. */
const CHROME = { light: "#f4f2ee", dark: "#0a0908" };

function paintChrome(light: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", light ? CHROME.light : CHROME.dark);
}

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
    const stored = document.documentElement.getAttribute("data-theme") === "light";
    setLight(stored);
    // The bootstrap runs before Next has necessarily emitted its own
    // `theme-color`, so the tag is re-synced once the tree is mounted.
    paintChrome(stored);
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
    paintChrome(next);
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
