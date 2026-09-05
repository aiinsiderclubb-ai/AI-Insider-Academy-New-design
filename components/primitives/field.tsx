"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border bg-surface px-3.5 text-sm text-ink shadow-xs outline-none " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-faint " +
  "focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)] " +
  "disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted";

/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
  action,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
              {label}
              {required && (
                <span className="ml-1 text-accent" aria-hidden>
                  *
                </span>
              )}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[12.5px] leading-snug text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: React.ReactNode; trailing?: React.ReactNode }
>(function Input({ className, invalid, leading, trailing, ...props }, ref) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      {...props}
      className={cn(
        control,
        "h-10",
        invalid ? "border-danger focus:border-danger focus:ring-[color-mix(in_oklab,var(--danger)_30%,transparent)]" : "border-line-2",
        leading && "pl-10",
        trailing && "pr-10",
        className,
      )}
    />
  );

  if (!leading && !trailing) return field;

  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint" aria-hidden>
          {leading}
        </span>
      )}
      {field}
      {trailing && <span className="absolute inset-y-0 right-2.5 flex items-center">{trailing}</span>}
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      {...props}
      className={cn(control, "resize-y py-2.5 leading-relaxed", invalid ? "border-danger" : "border-line-2", className)}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        className={cn(control, "h-10 appearance-none border-line-2 pr-9", className)}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
    </div>
  );
});

/* -------------------------------------------------------------------------- */

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode; description?: string }) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 inline-flex">
        <input
          id={props.id ?? id}
          type="checkbox"
          {...props}
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-line-3 bg-surface transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 scale-75 text-on-accent opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden
        />
      </span>
      {(label || description) && (
        <label htmlFor={props.id ?? id} className="cursor-pointer select-none">
          {label && <span className="block text-sm leading-snug text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>}
        </label>
      )}
    </div>
  );
}

export function Switch({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode; description?: string }) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      {(label || description) && (
        <label htmlFor={props.id ?? id} className="cursor-pointer select-none">
          {label && <span className="block text-sm font-medium leading-snug text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>}
        </label>
      )}
      {/*
        Every call site is controlled, so the switch role states its value
        outright instead of leaning on the native checkbox mapping. Declared
        before the spread, a caller can still override it.
      */}
      <input
        id={props.id ?? id}
        type="checkbox"
        role="switch"
        aria-checked={props.checked}
        {...props}
        className={cn(
          "relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full border border-line-2 bg-surface-3 transition-colors",
          "checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
          "after:absolute after:top-1/2 after:left-0.5 after:h-[18px] after:w-[18px] after:-translate-y-1/2 after:rounded-full",
          "after:bg-surface after:shadow-xs after:transition-transform after:content-['']",
          "checked:after:translate-x-4 checked:after:bg-white",
        )}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

/** Two-to-four exclusive options; the pill slides rather than jumping. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-grid rounded-full border border-line bg-surface-2 p-1",
        size === "sm" ? "h-9 text-[13px]" : "h-11 text-sm",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-surface shadow-xs transition-transform duration-250 ease-[var(--ease-out-quart)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${index} * 100%))`,
          left: "0.25rem",
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 rounded-full px-4 font-medium whitespace-nowrap transition-colors",
            option.value === value ? "text-ink" : "text-muted hover:text-ink-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
