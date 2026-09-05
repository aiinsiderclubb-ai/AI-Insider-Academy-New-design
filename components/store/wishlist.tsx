"use client";

import * as React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { EmptyState } from "@/components/primitives/states";
import { path, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const KEY = "aia-wishlist";
const EVENT = "aia-wishlist-change";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode — the list simply won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * The wishlist lives on the device: the API has no endpoint for it yet, and a
 * saved item is more useful than no saving at all. `useSyncExternalStore` keeps
 * every heart on the page in step without a provider.
 */
export function useWishlist() {
  const ids = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => localStorage.getItem(KEY) ?? "[]",
    () => "[]",
  );

  const list = React.useMemo<string[]>(() => {
    try {
      return JSON.parse(ids) as string[];
    } catch {
      return [];
    }
  }, [ids]);

  const toggle = React.useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  return { list, toggle, has: (id: string) => list.includes(id) };
}

/* -------------------------------------------------------------------------- */

export function WishlistButton({
  id,
  labels,
  className,
}: {
  id: string;
  /** Already localised by the caller — the button holds no copy of its own. */
  labels: { add: string; added: string };
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const saved = has(id);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(id);
      }}
      aria-pressed={saved}
      aria-label={saved ? labels.added : labels.add}
      title={saved ? labels.added : labels.add}
      className={cn(
        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
        saved
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] text-ink-3 backdrop-blur-sm hover:border-line-2 hover:text-ink",
        className,
      )}
    >
      <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

export interface WishlistItem {
  id: string;
  slug: string;
  title: string;
  price: string;
  category: string;
}

/** Renders the saved slice of a catalogue passed in from the server. */
export function WishlistPanel({
  locale,
  catalogue,
  labels,
}: {
  locale: Locale;
  catalogue: WishlistItem[];
  labels: { title: string; empty: string; emptyBody: string; browse: string; remove: string };
}) {
  const { list, toggle } = useWishlist();
  const items = catalogue.filter((item) => list.includes(item.id));

  if (!items.length) {
    return (
      <EmptyState
        compact
        icon={<Heart className="h-5 w-5" aria-hidden />}
        title={labels.empty}
        body={labels.emptyBody}
        action={
          <Link
            href={path("/store", locale)}
            className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-on-accent"
          >
            {labels.browse}
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 bg-surface p-4">
          <Link href={path(`/store/${item.slug}`, locale)} className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-ink">{item.title}</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">{item.category}</span>
          </Link>
          <span className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-[13px] tabular-nums text-ink-2">{item.price}</span>
            <Button variant="ghost" size="sm" icon aria-label={labels.remove} onClick={() => toggle(item.id)}>
              <Heart className="h-4 w-4 text-accent" fill="currentColor" aria-hidden />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
