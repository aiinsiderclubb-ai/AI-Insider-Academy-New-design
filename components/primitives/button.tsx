import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-quart)] " +
  "disabled:pointer-events-none disabled:opacity-45 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent shadow-xs hover:bg-accent-strong hover:shadow-glow hover:-translate-y-px " +
    "active:translate-y-0",
  secondary:
    "bg-surface text-ink border border-line-2 shadow-xs hover:bg-surface-2 hover:border-line-3 " +
    "hover:-translate-y-px active:translate-y-0",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  subtle: "bg-accent-soft text-accent-ink hover:bg-accent-soft-2",
  danger: "bg-danger text-white hover:brightness-110 shadow-xs",
  link: "text-accent-ink underline-offset-4 hover:underline px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

const iconSizes: Record<Size, string> = {
  sm: "h-8 w-8 px-0",
  md: "h-10 w-10 px-0",
  lg: "h-12 w-12 px-0",
};

export interface ButtonBaseProps {
  variant?: Variant;
  size?: Size;
  /** Square button holding a single icon — pass an accessible `aria-label`. */
  icon?: boolean;
  /** Replaces the label with a spinner and blocks interaction. */
  loading?: boolean;
  full?: boolean;
}

export type ButtonProps = ButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

export type ButtonLinkProps = ButtonBaseProps &
  Omit<React.ComponentProps<typeof Link>, "href"> & { href: string };

function classes({ variant = "primary", size = "md", icon, full }: ButtonBaseProps) {
  return cn(
    base,
    variants[variant],
    icon ? iconSizes[size] : sizes[size],
    full && "w-full",
    variant === "link" && "h-auto",
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("h-4 w-4 animate-spin", className)}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant,
  size,
  icon,
  full,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(classes({ variant, size, icon, full }), className)}
    >
      {loading && <Spinner />}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0 absolute")}>{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  full,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={cn(classes({ variant, size, icon, full }), className)}>
      {children}
    </Link>
  );
}
