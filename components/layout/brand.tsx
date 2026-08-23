import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Concentric squares — a frame within a frame. Reads as "inside" at 20px and
 * still holds up as a favicon, which a lettermark in a rounded box does not.
 */
export function BrandMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0 text-accent", className)}
    >
      <rect width="24" height="24" rx="7" fill="currentColor" />
      <rect x="6" y="6" width="12" height="12" rx="3.6" stroke="var(--on-accent)" strokeWidth="1.9" />
      <rect x="10" y="10" width="4" height="4" rx="1.3" fill="var(--on-accent)" />
    </svg>
  );
}

export function Brand({
  href,
  name,
  sub,
  compact,
  className,
}: {
  href: string;
  name: string;
  sub: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group flex items-center gap-2.5 rounded-md outline-offset-4", className)}
      aria-label={`${name} ${sub}`}
    >
      <BrandMark size={compact ? 24 : 26} className="transition-transform duration-200 group-hover:-rotate-6" />
      {!compact && (
        <span className="font-display text-[15px] leading-none font-extrabold tracking-[-0.03em] text-ink">
          {name}
          <span className="ml-1 font-medium text-muted">{sub}</span>
        </span>
      )}
    </Link>
  );
}
