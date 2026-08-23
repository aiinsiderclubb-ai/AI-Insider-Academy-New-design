"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Drawer } from "@/components/primitives/overlay";
import { Chip } from "@/components/primitives/badge";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function useQueryWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const write = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  return { write, params, pending };
}

/* ================================== search ================================= */

function StoreSearchInner({ d, className }: { d: Dictionary; className?: string }) {
  const { write, params, pending } = useQueryWriter();
  const [value, setValue] = React.useState(params.get("q") ?? "");
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => write({ q: value.trim() || null }), 280);
    return () => window.clearTimeout(timer);
  }, [value, write]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={d.store.searchPlaceholder}
        aria-label={d.nav.search}
        className={cn(
          "h-13 w-full rounded-lg border border-line bg-surface pr-11 pl-11 text-[15px] shadow-xs outline-none",
          "transition-[border-color,box-shadow] placeholder:text-faint",
          "focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]",
          pending && "opacity-80",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={d.common.reset}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/* =================================== sort ================================== */

function StoreSortInner({ d, className }: { d: Dictionary; className?: string }) {
  const { write, params } = useQueryWriter();
  const current = params.get("sort") ?? "popular";

  const options = [
    { value: "popular", label: d.store.sortPopular },
    { value: "trending", label: d.store.sortTrending },
    { value: "new", label: d.store.sortNewest },
    { value: "rating", label: d.store.sortRating },
    { value: "price-asc", label: d.store.sortPriceAsc },
    { value: "price-desc", label: d.store.sortPriceDesc },
  ];

  return (
    <label className={cn("flex items-center gap-2 text-[13px] text-muted", className)}>
      <span className="whitespace-nowrap">{d.common.sortBy}</span>
      <select
        value={current}
        onChange={(event) => write({ sort: event.target.value === "popular" ? null : event.target.value })}
        className="h-9 rounded-md border border-line bg-surface px-2.5 pr-7 text-[13px] font-medium text-ink shadow-xs outline-none focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ================================== facets ================================= */

export interface FacetCategory {
  slug: string;
  label: string;
  count: number;
}

const PRICE_BANDS = [
  { id: "0-29", min: 0, max: 29 },
  { id: "30-79", min: 30, max: 79 },
  { id: "80-149", min: 80, max: 149 },
  { id: "150+", min: 150, max: 9999 },
];

function FacetBody({ d, categories }: { d: Dictionary; categories: FacetCategory[] }) {
  const { write, params } = useQueryWriter();
  const category = params.get("category") ?? "all";
  const band = params.get("price") ?? "all";
  const rating = params.get("rating") ?? "all";

  return (
    <div className="flex flex-col gap-7">
      <fieldset>
        <legend className="eyebrow mb-3">{d.store.categories}</legend>
        <ul className="flex flex-col gap-0.5">
          <li>
            <button
              type="button"
              onClick={() => write({ category: null })}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors",
                category === "all" ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-3",
              )}
            >
              {d.common.all}
              <span className="font-mono text-[11px] tabular-nums text-faint">
                {categories.reduce((sum, item) => sum + item.count, 0)}
              </span>
            </button>
          </li>
          {categories.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => write({ category: category === item.slug ? null : item.slug })}
                disabled={item.count === 0}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors disabled:opacity-40",
                  category === item.slug ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-3",
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-faint">{item.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">{d.store.filterPrice}</legend>
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map((item) => (
            <Chip
              key={item.id}
              active={band === item.id}
              onClick={() => write({ price: band === item.id ? null : item.id })}
            >
              {item.max > 1000 ? `${item.min}+ €` : `${item.min}–${item.max} €`}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">{d.store.filterRating}</legend>
        <div className="flex flex-wrap gap-2">
          {["4.5", "4.8"].map((value) => (
            <Chip key={value} active={rating === value} onClick={() => write({ rating: rating === value ? null : value })}>
              {value}+
            </Chip>
          ))}
        </div>
      </fieldset>

      {(category !== "all" || band !== "all" || rating !== "all") && (
        <button
          type="button"
          onClick={() => write({ category: null, price: null, rating: null })}
          className="self-start text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          {d.common.clearFilters}
        </button>
      )}
    </div>
  );
}

function StoreFacetsInner({ d, categories }: { d: Dictionary; categories: FacetCategory[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="hidden lg:block">
        <FacetBody d={d} categories={categories} />
      </div>

      <div className="lg:hidden">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {d.common.filters}
        </Button>
        <Drawer open={open} onClose={() => setOpen(false)} title={d.common.filters} side="bottom">
          <FacetBody d={d} categories={categories} />
        </Drawer>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * `useSearchParams` has to sit behind a Suspense boundary: without one the page
 * opts out of prerendering and its client tree never hydrates.
 */
export function StoreSearch(props: { d: Dictionary; className?: string }) {
  return (
    <React.Suspense
      fallback={<div className={cn("h-13 rounded-lg border border-line bg-surface", props.className)} aria-hidden />}
    >
      <StoreSearchInner {...props} />
    </React.Suspense>
  );
}

export function StoreSort(props: { d: Dictionary; className?: string }) {
  return (
    <React.Suspense fallback={<div className="h-9 w-44" aria-hidden />}>
      <StoreSortInner {...props} />
    </React.Suspense>
  );
}

export function StoreFacets(props: { d: Dictionary; categories: FacetCategory[] }) {
  return (
    <React.Suspense fallback={<div className="h-64" aria-hidden />}>
      <StoreFacetsInner {...props} />
    </React.Suspense>
  );
}
