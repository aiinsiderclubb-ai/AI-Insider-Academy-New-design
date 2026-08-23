"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";
import { MenuItem, MenuLabel, Popover } from "@/components/primitives/overlay";
import { localeNames, localeShort, locales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Switches locale in place: the current path keeps its shape, only the first
 * segment changes, so a visitor reading a product page stays on that product.
 */
export function LanguageMenu({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const switchTo = (next: Locale) => {
    document.cookie = `aia-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const segments = pathname.split("/");
    segments[1] = next;
    startTransition(() => router.replace(segments.join("/") || `/${next}`));
  };

  return (
    <Popover
      className={className}
      label={label}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label={label}
          aria-expanded={open}
          aria-busy={pending || undefined}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-md px-2.5 font-mono text-2xs tracking-[0.1em] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink",
            open && "bg-surface-3 text-ink",
          )}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden />
          {localeShort[locale]}
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{label}</MenuLabel>
          {locales.map((option) => (
            <MenuItem
              key={option}
              active={option === locale}
              lang={option === "ukr" ? "uk" : option}
              onClick={() => {
                switchTo(option);
                close();
              }}
            >
              <span className="font-mono text-2xs tracking-[0.1em] text-faint">{localeShort[option]}</span>
              <span className="flex-1">{localeNames[option]}</span>
              {option === locale && <Check className="h-3.5 w-3.5" aria-hidden />}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}
