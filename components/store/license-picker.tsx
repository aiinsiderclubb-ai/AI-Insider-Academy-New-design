"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, Infinity as InfinityIcon, User, Users } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button, ButtonLink } from "@/components/primitives/button";
import { useToast } from "@/components/primitives/toast";
import type { ProductLicense } from "@/lib/api/store";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LICENSE_ICON = { personal: User, client: Users, agency: InfinityIcon } as const;

/**
 * Licences are the reason two buyers pay different prices, so they get full
 * cards with the client limit spelled out — not three cramped radio rows.
 */
export function LicensePicker({
  slug,
  licenses,
  locale,
  d,
  available,
  discountPercent,
}: {
  slug: string;
  licenses: ProductLicense[];
  locale: Locale;
  d: Dictionary;
  available: boolean;
  discountPercent?: number;
}) {
  const [selected, setSelected] = React.useState(licenses[0]?.id ?? "personal");
  const license = licenses.find((item) => item.id === selected) ?? licenses[0];
  const discounted = discountPercent ? Math.round(license.priceEur * (1 - discountPercent)) : null;

  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <p className="eyebrow">{d.store.licenseTitle}</p>

      <div className="mt-3.5 flex flex-col gap-2">
        {licenses.map((item) => {
          const Icon = LICENSE_ICON[item.id] ?? User;
          const active = item.id === selected;
          return (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors",
                active ? "border-accent bg-accent-soft" : "border-line hover:border-line-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="license"
                value={item.id}
                checked={active}
                onChange={() => setSelected(item.id)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
                    {item.label}
                  </span>
                  <span className="font-mono text-[14px] tabular-nums text-ink">{formatPrice(item.priceEur, locale)}</span>
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-ink-3">{item.note}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="flex items-baseline gap-2.5">
          <span className="font-display text-[2.25rem] leading-none font-extrabold tracking-tight tabular-nums">
            {formatPrice(discounted ?? license.priceEur, locale)}
          </span>
          {discounted !== null && (
            <span className="font-mono text-[13px] text-faint line-through tabular-nums">
              {formatPrice(license.priceEur, locale)}
            </span>
          )}
        </p>
        {discounted !== null && (
          <Badge tone="success" className="mt-2">
            −{Math.round((discountPercent ?? 0) * 100)}% · {d.plans.title}
          </Badge>
        )}
      </div>

      {available ? (
        <ButtonLink href={path(`/store/${slug}/buy?license=${selected}`, locale)} size="lg" className="mt-4" full>
          {d.common.buy}
        </ButtonLink>
      ) : (
        <div className="mt-4 rounded-md border border-warning/35 bg-warning-soft p-3.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {d.store.salesClosed}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{d.store.salesClosedBody}</p>
        </div>
      )}

      <ul className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
        {[d.store.instantAccess, d.store.lifetimeUpdates, d.store.commercialLicense].map((item) => (
          <li key={item} className="flex items-center gap-2 text-[12.5px] text-ink-3">
            <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Free sample: the one thing that turns a browser into a buyer. */
export function FreePreview({
  title,
  content,
  d,
}: {
  title: string;
  content: string;
  d: Dictionary;
}) {
  const { push } = useToast();
  const [copied, setCopied] = React.useState(false);
  const router = useRouter();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      push({ tone: "success", title: d.common.copied });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push({ tone: "warning", title: d.errors.generic });
    }
    router.refresh();
  };

  return (
    <section className="overflow-hidden rounded-lg border border-accent/35 bg-accent-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="eyebrow text-accent-ink">{d.store.tryFree}</p>
          <p className="mt-1.5 text-[15px] font-semibold text-ink">{title}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? d.common.copied : d.common.copy}
        </Button>
      </div>
      <pre className="scroll-x border-t border-accent/20 bg-surface px-5 py-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
        {content}
      </pre>
    </section>
  );
}
