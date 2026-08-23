"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { localeNames, localeShort, locales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * All three locales shown at once, the way a multilingual product should:
 * switching keeps the current path so a reader stays on the page they were on.
 */
export function LanguagePills({
  locale,
  label,
  className,
}: {
  locale: Locale;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `aia-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const segments = pathname.split("/");
    segments[1] = next;
    startTransition(() => router.replace(segments.join("/") || `/${next}`));
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-busy={pending || undefined}
      className={cn("flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5", className)}
    >
      {locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            lang={option === "ukr" ? "uk" : option}
            title={localeNames[option]}
            onClick={() => switchTo(option)}
            className={cn(
              "flex h-7 items-center rounded-full px-2.5 font-mono text-[10.5px] tracking-[0.12em] transition-colors",
              active ? "bg-accent text-on-accent" : "text-muted hover:text-ink",
            )}
          >
            {localeShort[option]}
          </button>
        );
      })}
    </div>
  );
}
