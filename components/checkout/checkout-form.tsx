"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, Landmark, Loader2, Send, TestTube2 } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import type { ProviderId } from "@/lib/api/checkout";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CheckoutTier {
  id: string;
  label: string;
  note?: string;
  priceEur: number;
  /** Sent to the API as the purchasable item id. */
  itemId: string;
}

const PROVIDER_META: Record<ProviderId, { icon: React.ElementType; endpoint: string }> = {
  stripe: { icon: CreditCard, endpoint: "/api/payments/stripe/checkout" },
  liqpay: { icon: Landmark, endpoint: "/api/payments/liqpay/create" },
  tribute: { icon: Send, endpoint: "/api/payments/tribute/checkout" },
  demo: { icon: TestTube2, endpoint: "/api/payments/demo" },
};

/** Maps a server error code onto copy the reader can act on. */
function messageFor(code: string, status: number, d: Dictionary): string {
  if (code === "PRELAUNCH_MODE" || status === 423) return d.errors.prelaunch;
  if (status === 401 || status === 403) return d.errors.unauthorized;
  if (status === 404) return d.errors.providerDisabled;
  if (status === 429) return d.errors.rateLimited;
  if (status === 0) return d.errors.network;
  return d.errors.paymentFailed;
}

export function CheckoutForm({
  locale,
  d,
  tiers,
  defaultTier,
  providers,
  prelaunch,
  signedIn,
  successHref,
  providerLabels,
}: {
  locale: Locale;
  d: Dictionary;
  tiers: CheckoutTier[];
  defaultTier?: string;
  providers: ProviderId[];
  prelaunch: boolean;
  signedIn: boolean;
  successHref: string;
  providerLabels: Record<ProviderId, { name: string; note: string }>;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [tierId, setTierId] = React.useState(defaultTier ?? tiers[0]?.id);
  const [provider, setProvider] = React.useState<ProviderId | null>(providers[0] ?? null);
  const [promo, setPromo] = React.useState("");
  const [promoState, setPromoState] = React.useState<
    { status: "idle" } | { status: "checking" } | { status: "ok"; finalEur: number } | { status: "error"; message: string }
  >({ status: "idle" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [digitalWaiver, setDigitalWaiver] = React.useState(false);

  const tier = tiers.find((item) => item.id === tierId) ?? tiers[0];
  const base = tier?.priceEur ?? 0;
  const total = promoState.status === "ok" ? promoState.finalEur : base;
  const discount = Math.max(0, base - total);

  React.useEffect(() => {
    // A new tier invalidates any quote tied to the previous price.
    setPromoState({ status: "idle" });
  }, [tierId]);

  async function applyPromo(event: React.FormEvent) {
    event.preventDefault();
    if (!promo.trim() || !tier) return;
    setPromoState({ status: "checking" });
    try {
      const response = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: promo.trim(), courseId: tier.itemId, amountEur: base }),
      });
      const payload = (await response.json().catch(() => ({}))) as { finalEur?: number; reason?: string };
      if (!response.ok || typeof payload.finalEur !== "number") {
        setPromoState({ status: "error", message: payload.reason === "expired" ? d.checkout.promoExpired : d.checkout.promoInvalid });
        return;
      }
      setPromoState({ status: "ok", finalEur: payload.finalEur });
      push({ tone: "success", title: d.checkout.promoApplied });
    } catch {
      setPromoState({ status: "error", message: d.errors.network });
    }
  }

  async function pay() {
    if (!tier || !provider) return;
    if (!signedIn) {
      router.push(`/${locale}/login?next=${encodeURIComponent(successHref)}`);
      return;
    }

    if (!digitalWaiver) {
      setError(d.checkout.waiverRequired);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(PROVIDER_META[provider].endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ courseId: tier.itemId, promoCode: promoState.status === "ok" ? promo.trim() : undefined, locale }),
      });

      const payload = (await response.json().catch(() => ({}))) as { url?: string; code?: string; error?: string };

      if (!response.ok) {
        setError(messageFor(payload.code ?? "", response.status, d));
        return;
      }

      if (payload.url) {
        window.location.href = payload.url;
        return;
      }

      push({ tone: "success", title: d.checkout.successTitle, body: d.checkout.successBody });
      router.push(successHref);
      router.refresh();
    } catch {
      setError(d.errors.network);
    } finally {
      setSubmitting(false);
    }
  }

  if (prelaunch) {
    return (
      <div className="rounded-lg border border-warning/35 bg-warning-soft p-5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-warning">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {d.store.salesClosed}
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{d.errors.prelaunch}</p>
        <Button variant="secondary" className="mt-4" full onClick={() => router.push(`/${locale}/plans`)}>
          {d.plans.compare}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <p className="eyebrow">{d.checkout.title}</p>

      {/* --------------------------------- tiers -------------------------------- */}
      {tiers.length > 1 && (
        <fieldset className="mt-4">
          <legend className="sr-only">{d.checkout.yourOrder}</legend>
          <div className="flex flex-col gap-2">
            {tiers.map((item) => (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors",
                  item.id === tierId ? "border-accent bg-accent-soft" : "border-line hover:border-line-2 hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="tier"
                  value={item.id}
                  checked={item.id === tierId}
                  onChange={() => setTierId(item.id)}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-ink">{item.label}</span>
                    <span className="font-mono text-[14px] tabular-nums text-ink">{formatPrice(item.priceEur, locale)}</span>
                  </span>
                  {item.note && <span className="mt-1 block text-[12.5px] leading-snug text-ink-3">{item.note}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* --------------------------------- promo -------------------------------- */}
      <form onSubmit={applyPromo} className="mt-5">
        <Field
          label={d.checkout.promoCode}
          htmlFor="promo"
          error={promoState.status === "error" ? promoState.message : undefined}
          hint={promoState.status === "ok" ? d.checkout.promoApplied : undefined}
        >
          <div className="flex gap-2">
            <Input
              id="promo"
              value={promo}
              onChange={(event) => setPromo(event.target.value.toUpperCase())}
              placeholder="AI2026"
              autoComplete="off"
              invalid={promoState.status === "error"}
              className="font-mono tracking-wide"
            />
            <Button type="submit" variant="secondary" loading={promoState.status === "checking"} disabled={!promo.trim()}>
              {d.checkout.promoApply}
            </Button>
          </div>
        </Field>
      </form>

      {/* -------------------------------- summary ------------------------------- */}
      <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[13.5px]">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-3">{d.checkout.subtotal}</dt>
          <dd className="font-mono tabular-nums text-ink-2">{formatPrice(base, locale)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">{d.checkout.discount}</dt>
            <dd className="font-mono tabular-nums text-success">−{formatPrice(discount, locale)}</dd>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="text-[14px] font-medium text-ink">{d.checkout.total}</dt>
          <dd className="font-display text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums">
            {formatPrice(total, locale)}
          </dd>
        </div>
      </dl>

      {/* -------------------------------- providers ----------------------------- */}
      <fieldset className="mt-5">
        <legend className="eyebrow mb-2.5">{d.checkout.paymentMethod}</legend>
        {providers.length === 0 ? (
          <p className="rounded-md border border-line bg-surface-2 px-3.5 py-3 text-[13px] text-ink-3">
            {d.errors.providerDisabled}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {providers.map((id) => {
              const Icon = PROVIDER_META[id].icon;
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                    id === provider ? "border-accent bg-accent-soft" : "border-line hover:border-line-2 hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={id}
                    checked={id === provider}
                    onChange={() => setProvider(id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{providerLabels[id].name}</span>
                    <span className="block text-[12px] text-muted">{providerLabels[id].note}</span>
                  </span>
                  {id === "demo" && <Badge tone="outline">test</Badge>}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] text-ink-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          {error}
        </p>
      )}

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-ink-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={digitalWaiver}
          onChange={(event) => setDigitalWaiver(event.target.checked)}
        />
        <span>{d.checkout.digitalWaiver}</span>
      </label>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">{d.checkout.emailMatch}</p>

      <Button
        onClick={pay}
        size="lg"
        full
        className="mt-5"
        loading={submitting}
        disabled={!provider || !tier || !digitalWaiver}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {d.checkout.processing}
          </>
        ) : (
          `${d.checkout.pay} ${formatPrice(total, locale)}`
        )}
      </Button>

      <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">
        {d.checkout.termsLead}{" "}
        <Link href={path("/legal/offer", locale)} className="underline underline-offset-2 hover:text-ink">
          {d.checkout.termsOffer}
        </Link>{" "}
        {d.checkout.termsAnd}{" "}
        <Link href={path("/legal/refund", locale)} className="underline underline-offset-2 hover:text-ink">
          {d.checkout.termsRefund}
        </Link>
        .
      </p>
    </div>
  );
}
