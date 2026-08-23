"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/components/primitives/badge";
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

/**
 * Filters live in the URL, not in component state: a filtered shelf can be
 * shared, bookmarked and re-rendered on the server with the same result.
 *
 * `useSearchParams` needs a Suspense boundary of its own, otherwise the whole
 * page opts out of prerendering and never hydrates.
 */
export function FilterBar(props: { groups: FilterGroup[]; className?: string; resetLabel: string }) {
  return (
    <React.Suspense fallback={<FilterBarSkeleton groups={props.groups} className={props.className} />}>
      <FilterBarInner {...props} />
    </React.Suspense>
  );
}

function FilterBarSkeleton({ groups, className }: { groups: FilterGroup[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)} aria-hidden>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-full sm:w-auto">{group.label}</span>
          {group.options.map((option) => (
            <span
              key={option.value}
              className="inline-flex h-9 items-center rounded-full border border-line-2 bg-surface px-3.5 text-[13px] font-medium text-ink-2"
            >
              {option.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterBarInner({
  groups,
  className,
  resetLabel,
}: {
  groups: FilterGroup[];
  className?: string;
  resetLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const clear = () => startTransition(() => router.replace(pathname, { scroll: false }));

  const active = groups.some((group) => params.get(group.key));

  return (
    <div className={cn("flex flex-col gap-4", pending && "opacity-70", className)}>
      {groups.map((group) => {
        const current = params.get(group.key) ?? "all";
        return (
          <div key={group.key} className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1 w-full sm:w-auto">{group.label}</span>
            {group.options.map((option) => (
              <Chip
                key={option.value}
                active={current === option.value}
                count={option.count}
                onClick={() => apply(group.key, option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        );
      })}

      {active && (
        <button
          type="button"
          onClick={clear}
          className="self-start text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}
