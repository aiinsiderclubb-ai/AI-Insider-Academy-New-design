"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CornerDownLeft, Package, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

export interface SearchEntry {
  id: string;
  kind: "course" | "product" | "page";
  title: string;
  note?: string;
  href: string;
  keywords?: string;
}

const ICONS: Record<SearchEntry["kind"], React.ElementType> = {
  course: BookOpen,
  product: Package,
  page: Sparkles,
};

/**
 * ⌘K over the whole catalogue. The old platform had forty-one products and no
 * search field anywhere; this is the fastest path to any of them.
 */
export function CommandSearch({
  open,
  onClose,
  entries,
  d,
}: {
  open: boolean;
  onClose: () => void;
  entries: SearchEntry[];
  d: Dictionary;
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries.slice(0, 8);
    return entries
      .filter((entry) => `${entry.title} ${entry.note ?? ""} ${entry.keywords ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [entries, query]);

  React.useEffect(() => setCursor(0), [query]);

  const go = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[cursor]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={d.nav.search}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={cn(
        "mx-auto mt-[12vh] mb-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-line bg-surface p-0 text-ink shadow-lg",
        "backdrop:bg-[rgb(23_19_15/0.5)] backdrop:backdrop-blur-[3px] open:animate-pop",
      )}
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={d.store.searchPlaceholder}
          aria-label={d.nav.search}
          className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">ESC</kbd>
      </div>

      {results.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-display text-base font-extrabold tracking-tight">{d.store.emptyTitle}</p>
          <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-3">{d.store.emptyBody}</p>
        </div>
      ) : (
        <ul className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
          {results.map((entry, index) => {
            const Icon = ICONS[entry.kind];
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(entry)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    index === cursor ? "bg-surface-3" : "hover:bg-surface-2",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{entry.title}</span>
                    {entry.note && <span className="block truncate text-[12.5px] text-muted">{entry.note}</span>}
                  </span>
                  {index === cursor ? (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-line-3" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
