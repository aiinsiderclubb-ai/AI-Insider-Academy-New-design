"use client";

import * as React from "react";
import { CommandSearch, type SearchEntry } from "./command-search";
import { SiteHeader, type HeaderUser } from "./site-header";
import type { NavSection } from "./nav-model";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/** Owns the ⌘K state so the header stays a presentation component. */
export function SiteChrome({
  locale,
  d,
  nav,
  user,
  searchEntries,
}: {
  locale: Locale;
  d: Dictionary;
  nav: NavSection[];
  user: HeaderUser | null;
  searchEntries: SearchEntry[];
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <SiteHeader locale={locale} d={d} nav={nav} user={user} onOpenSearch={() => setSearchOpen(true)} />
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} entries={searchEntries} d={d} />
    </>
  );
}
