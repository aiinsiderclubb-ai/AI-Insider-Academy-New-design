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

/** `rated` is false until real buyers have rated something: sorting by an empty rating would only shuffle the shelf. */
function StoreSortInner({
  d,
  className,
  rated = false,
  quiet = false,
}: {
  d: Dictionary;
  className?: string;
  rated?: boolean;
  /** Keep the label for screen readers only, where the select speaks for itself. */
  quiet?: boolean;
}) {
  const { write, params } = useQueryWriter();
  const current = params.get("sort") ?? "popular";

  const options = [
    { value: "popular", label: d.store.sortPopular },
    { value: "trending", label: d.store.sortTrending },
    { value: "new", label: d.store.sortNewest },
    ...(rated ? [{ value: "rating", label: d.store.sortRating }] : []),
    { value: "price-asc", label: d.store.sortPriceAsc },
    { value: "price-desc", label: d.store.sortPriceDesc },
  ];

  return (
    <label className={cn("flex items-center gap-2 text-[13px] text-muted", className)}>
      <span className={quiet ? "sr-only" : "whitespace-nowrap"}>{d.common.sortBy}</span>
      <select
        value={current}
        onChange={(event) => write({ sort: event.target.value === "popular" ? null : event.target.value })}
        className="h-9 rounded-full border border-line bg-surface px-3.5 pr-8 text-[13px] font-medium text-ink outline-none focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]"
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

function FacetBody({ d, categories, rated = false }: { d: Dictionary; categories: FacetCategory[]; rated?: boolean }) {
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

      {rated && (
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
      )}

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

function StoreFacetsInner({ d, categories, rated }: { d: Dictionary; categories: FacetCategory[]; rated?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="hidden lg:block">
        <FacetBody d={d} categories={categories} rated={rated} />
      </div>

      <div className="lg:hidden">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {d.common.filters}
        </Button>
        <Drawer open={open} onClose={() => setOpen(false)} title={d.common.filters} side="bottom">
          <FacetBody d={d} categories={categories} rated={rated} />
        </Drawer>
      </div>
    </>
  );
}

/* ================================ filter bar =============================== */

const tab = (active: boolean) =>
  cn(
    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-[13.5px] whitespace-nowrap transition-colors",
    active ? "bg-ink font-medium text-ground" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
  );

/**
 * The catalogue's controls in one row above the grid: categories as tabs
 * (scrolling sideways on a phone), then price and order. It replaces the
 * sidebar so the grid gets the full width.
 */
function StoreFilterBarInner({
  d,
  categories,
  total,
  rated = false,
}: {
  d: Dictionary;
  categories: FacetCategory[];
  total: number;
  rated?: boolean;
}) {
  const { write, params, pending } = useQueryWriter();
  const category = params.get("category") ?? "all";
  const band = params.get("price") ?? "all";
  const strip = React.useRef<HTMLDivElement>(null);

  // A chosen category further along the strip is scrolled into sight — the strip only, never the page.
  React.useEffect(() => {
    const container = strip.current;
    const chosen = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!container || !chosen) return;
    const offset = chosen.offsetLeft - container.clientWidth / 2 + chosen.offsetWidth / 2;
    container.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
  }, [category]);

  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6", pending && "opacity-80")}>
      <div ref={strip} className="scroll-x no-scrollbar relative -mx-5 min-w-0 px-5 sm:mx-0 sm:px-0" role="tablist" aria-label={d.store.categories}>
        <div className="flex gap-1">
          <button type="button" role="tab" aria-selected={category === "all"} onClick={() => write({ category: null })} className={tab(category === "all")}>
            {d.common.all}
            <span className="font-mono text-[11px] tabular-nums opacity-60">{total}</span>
          </button>
          {categories
            .filter((item) => item.count > 0)
            .map((item) => (
              <button
                key={item.slug}
                type="button"
                role="tab"
                aria-selected={category === item.slug}
                onClick={() => write({ category: category === item.slug ? null : item.slug })}
                className={tab(category === item.slug)}
              >
                {item.label}
                <span className="font-mono text-[11px] tabular-nums opacity-60">{item.count}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <span className="sr-only">{d.store.filterPrice}</span>
          <select
            value={band}
            onChange={(event) => write({ price: event.target.value })}
            className="h-9 rounded-full border border-line bg-surface px-3.5 pr-8 text-[13px] font-medium text-ink outline-none focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]"
          >
            <option value="all">{d.store.filterPrice}</option>
            {PRICE_BANDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.max > 1000 ? `${item.min}+ €` : `${item.min}–${item.max} €`}
              </option>
            ))}
          </select>
        </label>
        <StoreSortInner d={d} rated={rated} quiet />
      </div>
    </div>
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

export function StoreSort(props: { d: Dictionary; className?: string; rated?: boolean }) {
  return (
    <React.Suspense fallback={<div className="h-9 w-44" aria-hidden />}>
      <StoreSortInner {...props} />
    </React.Suspense>
  );
}

export function StoreFacets(props: { d: Dictionary; categories: FacetCategory[]; rated?: boolean }) {
  return (
    <React.Suspense fallback={<div className="h-64" aria-hidden />}>
      <StoreFacetsInner {...props} />
    </React.Suspense>
  );
}

export function StoreFilterBar(props: { d: Dictionary; categories: FacetCategory[]; total: number; rated?: boolean }) {
  return (
    <React.Suspense fallback={<div className="h-9" aria-hidden />}>
      <StoreFilterBarInner {...props} />
    </React.Suspense>
  );
}
