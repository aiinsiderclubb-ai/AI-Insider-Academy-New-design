import Image from "next/image";
import type { Product } from "@/lib/api/store";
import { cn } from "@/lib/utils";

/**
 * Poster for a marketplace product. The title is set in the platform face on
 * the platform ground, so a shelf of forty items still reads as one shop and
 * each card still says which product it is.
 */
export function ProductCover({
  product,
  variant = "card",
  className,
}: {
  product: Pick<Product, "slug" | "title" | "categoryLabel" | "fileTypes">;
  variant?: "card" | "compact" | "hero";
  className?: string;
}) {
  const meta =
    variant === "hero"
      ? [product.categoryLabel, ...product.fileTypes.slice(0, 2)].filter(Boolean).join(" · ")
      : product.fileTypes.slice(0, 2).join(" · ");

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-ground text-ink", className)} aria-hidden>
      <Image
        src={`/covers/shelf/${product.slug}.jpg`}
        alt=""
        fill
        sizes={variant === "hero" ? "(max-width: 1024px) 100vw, 60vw" : "(max-width: 640px) 100vw, 25vw"}
        className="object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 130% 100% at 50% 36%, transparent 58%, color-mix(in oklab, var(--ground) 78%, transparent) 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-ground via-ground/55 to-transparent" />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col",
          variant === "hero" && "gap-3 p-6 pr-8 sm:p-8",
          variant === "card" && "gap-2 p-4 pr-14 pb-12",
          variant === "compact" && "gap-1.5 p-3 pr-12 pb-11",
        )}
      >
        <p
          className={cn(
            "max-w-[16ch] font-extrabold tracking-[-0.04em] text-balance text-ink",
            variant === "hero" && "max-w-[18ch] text-[clamp(1.7rem,3vw,2.6rem)] leading-[0.98]",
            variant === "card" && "line-clamp-3 text-[clamp(1.05rem,1.4vw,1.35rem)] leading-[1.05]",
            variant === "compact" && "line-clamp-2 text-[15px] leading-[1.05]",
          )}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {product.title}
        </p>
        {meta ? (
          <div className="flex items-center gap-2.5">
            <span className="h-px w-6 shrink-0 bg-accent" />
            <span className="truncate font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{meta}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
