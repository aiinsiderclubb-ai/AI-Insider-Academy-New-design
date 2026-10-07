"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Chip } from "@/components/primitives/badge";
import { Popover } from "@/components/primitives/overlay";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface FeaturedFilter {
  key: string;
  value: string;
  label: string;
  count?: number;
}

export interface SortControl {
  label: string;
  defaultLabel: string;
  options: { value: string; label: string }[];
}

/**
 * Filters live in the URL, not in component state: a filtered shelf can be
 * shared, bookmarked and re-rendered on the server with the same result.
 *
 * `useSearchParams` needs a Suspense boundary of its own, otherwise the whole
 * page opts out of prerendering and never hydrates.
 */
export function FilterBar(props: {
  groups: FilterGroup[];
  className?: string;
  resetLabel: string;
  filterLabel: string;
  featuredLabel?: string;
  featured?: FeaturedFilter[];
  sort?: SortControl;
}) {
  return (
    <React.Suspense fallback={<FilterBarSkeleton className={props.className} />}>
      <FilterBarInner {...props} />
    </React.Suspense>
  );
}

function FilterBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} aria-hidden>
      <span className="inline-flex h-11 w-32 rounded-full border border-line-2 bg-surface-2" />
      <span className="inline-flex h-11 w-40 rounded-full border border-line-2 bg-surface-2" />
    </div>
  );
}

function FilterBarInner({
  groups,
  className,
  resetLabel,
  filterLabel,
  featuredLabel,
  featured = [],
  sort,
}: {
  groups: FilterGroup[];
  className?: string;
  resetLabel: string;
  filterLabel: string;
  featuredLabel?: string;
  featured?: FeaturedFilter[];
  sort?: SortControl;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const commit = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const apply = (key: string, value: string) => {
    commit((next) => {
      if (!value || value === "all" || next.get(key) === value) next.delete(key);
      else next.set(key, value);
    });
  };

  const setSort = (value: string | null) => {
    commit((next) => {
      if (!value) next.delete("sort");
      else next.set("sort", value);
    });
  };

  const clearFilters = () => {
    commit((next) => {
      for (const group of groups) next.delete(group.key);
    });
  };

  const featuredKeys = new Set(featured.map((item) => `${item.key}:${item.value}`));
  const activeFilters = groups.flatMap((group) => {
    const current = params.get(group.key);
    if (!current || current === "all") return [];
    const option = group.options.find((item) => item.value === current);
    return [{ key: group.key, label: option?.label ?? current }];
  });
  const sortValue = params.get("sort");
  const sortOption = sort?.options.find((option) => option.value === sortValue);

  return (
    <div className={cn("flex flex-col gap-3", pending && "opacity-70", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Popover
          align="start"
          label={filterLabel}
          panelClassName="w-[min(36rem,calc(100vw-4.5rem))] p-4"
          trigger={({ open, toggle, ref }) => (
            <button
              ref={ref}
              type="button"
              className={triggerClass(activeFilters.length > 0)}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={toggle}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {filterLabel}
              {activeFilters.length > 0 && (
                <span className="font-mono text-[12px] tabular-nums">{activeFilters.length}</span>
              )}
            </button>
          )}
        >
          <div className="flex max-h-[min(28rem,70vh)] flex-col gap-5 overflow-y-auto">
            {featured.length > 0 && (
              <fieldset className="min-w-0 border-0 p-0">
                {featuredLabel && <legend className="eyebrow mb-2.5">{featuredLabel}</legend>}
                <div className="flex flex-wrap gap-2">
                  {featured.map((item) => (
                    <Chip
                      key={`${item.key}-${item.value}`}
                      active={params.get(item.key) === item.value}
                      count={item.count}
                      className="h-11"
                      onClick={() => apply(item.key, item.value)}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            )}

            {groups.map((group) => {
              const options = group.options.filter((option) => !featuredKeys.has(`${group.key}:${option.value}`));
              if (!options.length) return null;
              const current = params.get(group.key) ?? "all";
              return (
                <fieldset key={group.key} className="min-w-0 border-0 p-0">
                  <legend className="eyebrow mb-2.5">{group.label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => (
                      <Chip
                        key={option.value}
                        active={current === option.value}
                        count={option.count}
                        className="h-11"
                        onClick={() => apply(group.key, option.value)}
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              );
            })}

            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-start cursor-pointer text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
              >
                {resetLabel}
              </button>
            )}
          </div>
        </Popover>

        {sort && (
          <Popover
            align="start"
            label={sort.label}
            panelClassName="w-56 p-1.5"
            trigger={({ open, toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                className={triggerClass(Boolean(sortOption))}
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={toggle}
              >
                {sortOption ? sortOption.label : sort.label}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
              </button>
            )}
          >
            {(close) => (
              <div className="flex flex-col" role="listbox" aria-label={sort.label}>
                <SortChoice
                  label={sort.defaultLabel}
                  active={!sortOption}
                  onClick={() => {
                    setSort(null);
                    close();
                  }}
                />
                {sort.options.map((option) => (
                  <SortChoice
                    key={option.value}
                    label={option.label}
                    active={sortValue === option.value}
                    onClick={() => {
                      setSort(option.value);
                      close();
                    }}
                  />
                ))}
              </div>
            )}
          </Popover>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => apply(filter.key, params.get(filter.key) ?? "")}
              className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 text-[13px] font-medium text-accent-ink"
            >
              {filter.label}
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{resetLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function triggerClass(active: boolean) {
  return cn(
    "inline-flex h-11 cursor-pointer select-none items-center justify-center gap-2 rounded-full px-4 text-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow] duration-150",
    active
      ? "bg-accent-soft text-accent-ink"
      : "border border-line-2 bg-surface text-ink shadow-xs hover:border-line-3 hover:bg-surface-2",
  );
}

function SortChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full cursor-pointer items-center rounded-md px-3 text-left text-[14px] transition-colors",
        active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
