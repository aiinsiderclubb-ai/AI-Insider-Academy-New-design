"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, Landmark, Loader2, Send, ShieldCheck, TestTube2 } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import type { ProviderId } from "@/lib/api/checkout";
import { onPaddleEvent, openPaddleCheckout } from "@/lib/paddle-client";
import { formatPrice, path, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CheckoutTier {
  id: string;
  label: string;
  note?: string;
  priceEur: number;
  /** Sent to the API as the purchasable item id. */
  itemId: string;
  /** For a course: which plan is bought. The API prices it and records it. */
  plan?: "self" | "mentor";
  /**
   * The plan costs no more than the course's self-study price (the launch
   * offer), so single-price sellers — Gumroad, Tribute — can take it too.
   */
  atListPrice?: boolean;
}

const PROVIDER_META: Record<ProviderId, { icon: React.ElementType; endpoint: string }> = {
  paddle: { icon: ShieldCheck, endpoint: "/api/payments/paddle/checkout" },
  gumroad: { icon: ShieldCheck, endpoint: "/api/payments/gumroad/checkout" },
  stripe: { icon: CreditCard, endpoint: "/api/payments/stripe/checkout" },
  liqpay: { icon: Landmark, endpoint: "/api/payments/liqpay/create" },
  tribute: { icon: Send, endpoint: "/api/payments/tribute/checkout" },
  demo: { icon: TestTube2, endpoint: "/api/payments/demo" },
};

const MENTOR_PROVIDERS = new Set<ProviderId>(["paddle", "stripe", "liqpay", "demo"]);

/** The friend's code `proxy.ts` kept from a `?ref=` link, if any. */
function referralFromCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = /(?:^|;\s*)aia-ref=([A-Za-z0-9-]{4,32})/.exec(document.cookie);
  return match?.[1];
}

const noSubscription = () => () => {};

/** Maps a server error code onto copy the reader can act on. */
function messageFor(code: string, status: number, d: Dictionary, locale: Locale): string {
  if (code === "PRELAUNCH_MODE" || status === 423) return d.errors.prelaunch;
  if (code === "ALREADY_OWNED") {
    return locale === "en" ? "You already have this course in this plan." : locale === "ukr" ? "Цей курс у вас уже є в цьому тарифі." : "Этот курс у вас уже есть в этом тарифе.";
  }
  /* Tribute's fixed products and Gumroad sell one price, so they turn the mentor plan away. */
  if (code === "PLAN_NOT_AVAILABLE") {
    return locale === "en"
      ? "This payment method does not take the mentor plan yet — choose another method, or write to support."
      : locale === "ukr"
        ? "Цей спосіб оплати поки не приймає тариф з ментором — оберіть інший або напишіть у підтримку."
        : "Этот способ оплаты пока не принимает тариф с ментором — выберите другой или напишите в поддержку.";
  }
  /* Any other conflict: the item is not on sale at the payment service right now. */
  if (status === 409) {
    return locale === "en"
      ? "Payment for this item is not open right now. Write to support and we'll sort it out quickly."
      : locale === "ukr"
        ? "Оплата цього товару зараз недоступна. Напишіть у підтримку — швидко розберемося."
        : "Оплата этого товара сейчас недоступна. Напишите в поддержку — быстро разберёмся.";
  }
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
  storeItem = false,
  email,
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
  /** A store product: Paddle prices it by license through the marketplace quote. */
  storeItem?: boolean;
  /** Prefills Paddle's checkout. */
  email?: string;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [tierId, setTierId] = React.useState(defaultTier ?? tiers[0]?.id);
  const [pickedProvider, setProvider] = React.useState<ProviderId | null>(providers[0] ?? null);
  const [promo, setPromo] = React.useState("");
  // The server render has no cookie to agree with, so it renders without the note.
  const referred = React.useSyncExternalStore(
    noSubscription,
    () => Boolean(referralFromCookie()),
    () => false,
  );
  const [promoState, setPromoState] = React.useState<
    { status: "idle" } | { status: "checking" } | { status: "ok"; finalEur: number } | { status: "error"; message: string }
  >({ status: "idle" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [digitalWaiver, setDigitalWaiver] = React.useState(false);
  const [promoOpen, setPromoOpen] = React.useState(false);

  const tier = tiers.find((item) => item.id === tierId) ?? tiers[0];
  // Gumroad and Tribute sell one fixed price, so they cannot take the mentor plan.
  const sellers = tier?.plan === "mentor" && !tier.atListPrice ? providers.filter((id) => MENTOR_PROVIDERS.has(id)) : providers;

  const chosenProvider: ProviderId | null = pickedProvider && sellers.includes(pickedProvider) ? pickedProvider : (sellers[0] ?? null);
  const base = tier?.priceEur ?? 0;
  const total = promoState.status === "ok" ? promoState.finalEur : base;
  const discount = Math.max(0, base - total);
  // A code that takes the whole price off (TODAYFREE) skips the payment service entirely.
  const free = promoState.status === "ok" && total <= 0 && base > 0 && !storeItem;

  React.useEffect(() => {
    // A new tier invalidates any quote tied to the previous price, and any error about the old one.
    setPromoState({ status: "idle" });
    setError(null);
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

  async function claimFree() {
    if (!tier) return;
    if (!signedIn) {
      router.push(`/${locale}/login?next=${encodeURIComponent(successHref)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/free", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ courseId: tier.itemId, plan: tier.plan, promoCode: promo.trim(), locale }),
      });
      const payload = (await response.json().catch(() => ({}))) as { code?: string; errorRu?: string; error?: string };
      if (!response.ok) {
        setError(payload.errorRu ?? messageFor(payload.code ?? "", response.status, d, locale));
        return;
      }
      push({ tone: "success", title: locale === "en" ? "The course is yours" : "Курс ваш", body: locale === "en" ? "Access is open — start with the first lesson." : "Доступ открыт — начинайте с первого урока." });
      router.push(successHref);
      router.refresh();
    } catch {
      setError(d.errors.network);
    } finally {
      setSubmitting(false);
    }
  }

  async function pay() {
    if (free) return claimFree();
    const provider = chosenProvider;
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
      const ours = provider === "paddle" || provider === "gumroad";
      const storeQuote = ours && storeItem;
      const response = await fetch(storeQuote ? `/api/payments/${provider}/marketplace` : PROVIDER_META[provider].endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(storeQuote ? { productId: tier.itemId, licenseTier: tier.id } : { courseId: tier.itemId, plan: tier.plan }),
          promoCode: promoState.status === "ok" ? promo.trim() : undefined,
          referralCode: ours ? referralFromCookie() : undefined,
          locale,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        code?: string;
        error?: string;
        transactionId?: string;
        checkoutUrl?: string;
        successUrl?: string;
      };

      if (!response.ok) {
        setError(messageFor(payload.code ?? "", response.status, d, locale));
        return;
      }

      if (payload.transactionId) {
        // Access opens when Paddle's webhook reaches the API; the overlay only takes the money.
        onPaddleEvent((event) => {
          if (event.name === "checkout.completed") {
            push({ tone: "success", title: d.checkout.successTitle, body: d.checkout.successBody });
          }
        });
        await openPaddleCheckout({ transactionId: payload.transactionId, successUrl: payload.successUrl, locale, email });
        return;
      }

      if (payload.checkoutUrl) {
        // Gumroad's own checkout; the ping reaches the API and opens access.
        window.location.href = payload.checkoutUrl;
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

  const single = sellers.length === 1;
  const mentorBlocked = tier?.plan === "mentor" && sellers.length === 0 && !free;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {/* --------------------------------- tiers -------------------------------- */}
      <div className="p-5 pb-4">
        <p className="text-[13px] font-medium text-ink-3">{d.checkout.yourOrder}</p>
        {tiers.length > 1 ? (
          <fieldset className="mt-3">
            <legend className="sr-only">{d.checkout.yourOrder}</legend>
            <div className={cn("grid gap-2", tiers.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
              {tiers.map((item) => {
                const chosen = item.id === tierId;
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-[border-color,background-color] duration-200",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent-ring)]",
                      chosen ? "border-accent bg-accent-soft" : "border-line hover:border-line-2 hover:bg-surface-2",
                    )}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value={item.id}
                      checked={chosen}
                      onChange={() => setTierId(item.id)}
                      className="sr-only"
                    />
                    <span className="pr-6 text-[13.5px] leading-tight font-medium text-ink">{item.label}</span>
                    <span className="font-display text-[1.35rem] leading-none font-extrabold tracking-tight text-ink tabular-nums">
                      {formatPrice(item.priceEur, locale)}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-3 right-3 h-4 w-4 rounded-full border-2 transition-colors",
                        chosen ? "border-accent bg-accent shadow-[inset_0_0_0_2px_var(--accent-soft)]" : "border-line-2",
                      )}
                    />
                  </label>
                );
              })}
            </div>
            {tier?.note && <p className="mt-2.5 text-[12.5px] leading-snug text-ink-3">{tier.note}</p>}
          </fieldset>
        ) : (
          tier && (
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <p className="text-[15px] font-medium text-ink">{tier.label}</p>
              <p className="font-display text-[1.35rem] leading-none font-extrabold tracking-tight tabular-nums">
                {formatPrice(tier.priceEur, locale)}
              </p>
            </div>
          )
        )}
      </div>

      {/* --------------------------------- promo -------------------------------- */}
      <div className="border-t border-line px-5 py-3.5">
        {promoOpen || promoState.status !== "idle" ? (
          <form onSubmit={applyPromo}>
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
        ) : (
          <button
            type="button"
            onClick={() => setPromoOpen(true)}
            className="cursor-pointer text-[13px] text-ink-2 underline decoration-line-2 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
          >
            {locale === "en" ? "Have a promo code?" : locale === "ukr" ? "Є промокод?" : "Есть промокод?"}
          </button>
        )}

        {referred && (sellers.includes("paddle") || sellers.includes("gumroad")) && (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-accent-ink">
            {locale === "en"
              ? "You came by a friend's link: 10% off your first purchase is applied at payment, unless a promo code gives you more."
              : "Вы пришли по ссылке друга: −10% на первую покупку применится при оплате, если промокод не даёт больше."}
          </p>
        )}
      </div>

      {/* -------------------------------- providers ----------------------------- */}
      {sellers.length > 1 && (
        <fieldset className="border-t border-line px-5 py-4">
          <legend className="sr-only">{d.checkout.paymentMethod}</legend>
          <p className="mb-2.5 text-[13px] font-medium text-ink-3">{d.checkout.paymentMethod}</p>
          <div className="flex flex-col gap-1.5">
            {sellers.map((id) => {
              const Icon = PROVIDER_META[id].icon;
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    id === chosenProvider ? "border-accent bg-accent-soft" : "border-line hover:border-line-2 hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={id}
                    checked={id === chosenProvider}
                    onChange={() => setProvider(id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{providerLabels[id].name}</span>
                  {id === "demo" && <Badge tone="outline">test</Badge>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* --------------------------------- total -------------------------------- */}
      <div className="border-t border-line bg-surface-2 p-5">
        {discount > 0 && (
          <div className="mb-2 flex justify-between gap-4 text-[13px]">
            <span className="text-ink-3">
              {d.checkout.discount} <span className="text-faint line-through">{formatPrice(base, locale)}</span>
            </span>
            <span className="font-mono text-success tabular-nums">−{formatPrice(discount, locale)}</span>
          </div>
        )}

        {mentorBlocked ? (
          <div className="rounded-lg border border-line bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">
            {locale === "en"
              ? "The mentor plan is arranged by hand for now. Write to us and we'll set it up — or take self-study and move up later at the difference."
              : "Тариф с ментором пока оформляем вручную. Напишите нам — всё настроим. Или возьмите самостоятельный и перейдите позже, доплатив разницу."}
            <Link
              href={path("/app/support", locale)}
              className="mt-3 flex h-11 items-center justify-center rounded-full bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
            >
              {locale === "en" ? "Write to us" : "Написать нам"}
            </Link>
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-snug text-ink-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                checked={digitalWaiver}
                onChange={(event) => {
                  setDigitalWaiver(event.target.checked);
                  if (event.target.checked) setError(null);
                }}
              />
              <span>{d.checkout.digitalWaiver}</span>
            </label>

            {error && (
              <p role="alert" className="mt-3 flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[12.5px] text-ink-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                {error}
              </p>
            )}

            {free ? (
              <Button onClick={claimFree} size="lg" full className="mt-4" loading={submitting} disabled={!tier || !digitalWaiver}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {d.checkout.processing}
                  </>
                ) : locale === "en" ? (
                  "Start for free"
                ) : locale === "ukr" ? (
                  "Почати безкоштовно"
                ) : (
                  "Начать бесплатно"
                )}
              </Button>
            ) : sellers.length === 0 ? (
              <p className="mt-4 rounded-md border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-3">{d.errors.providerDisabled}</p>
            ) : (
              <Button onClick={pay} size="lg" full className="mt-4" loading={submitting} disabled={!chosenProvider || !tier || !digitalWaiver}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {d.checkout.processing}
                  </>
                ) : (
                  `${d.checkout.pay} ${formatPrice(total, locale)}`
                )}
              </Button>
            )}

            {single && chosenProvider && !free && (
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-muted">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {providerLabels[chosenProvider].note}
              </p>
            )}
            {chosenProvider === "tribute" && <p className="mt-2 text-center text-[12px] leading-relaxed text-ink-3">{d.checkout.emailMatch}</p>}
          </>
        )}

        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-faint">
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
    </div>
  );
}
