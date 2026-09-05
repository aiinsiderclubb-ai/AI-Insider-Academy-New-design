"use client";

import * as React from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import type { PartnerOffer } from "@/content/partners";
import { pick } from "@/content/locale";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One third-party offer.
 *
 * The code is the thing a learner has come for, so it is set in mono at a size
 * that survives being read off a phone and copied with one tap — retyping a
 * mistyped code costs them the whole discount, since it only fires once per
 * account.
 *
 * The conditions sit on the card rather than behind a link. Every one of them
 * can void the discount, and a rule discovered on day eleven is the same as no
 * discount at all.
 */
export function PartnerCard({
  offer,
  locale,
  d,
}: {
  offer: PartnerOffer;
  locale: Locale;
  d: Dictionary;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const codeRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  /**
   * The clipboard is not guaranteed: an insecure origin, a denied permission
   * or an unfocused document all reject. Claiming "copied" then would be a
   * lie the learner only discovers when they paste the wrong thing — so the
   * fallback selects the code instead, leaving it one keystroke away.
   */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(offer.code);
    } catch {
      selectCode();
      return;
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const selectCode = () => {
    const node = codeRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const terms = locale === "en" ? offer.termsEn : offer.termsRu;
  const tagline = locale === "en" ? offer.taglineEn : offer.taglineRu;
  const body = locale === "en" ? offer.bodyEn : offer.bodyRu;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-md">
      {/* ------------------------------- masthead ------------------------------ */}
      <div className="relative isolate overflow-hidden px-6 pt-6 pb-5" style={{ background: offer.gradient }}>
        <div aria-hidden className="absolute inset-0 bg-[rgb(10_9_8/0.32)]" />
        <div className="relative flex items-start justify-between gap-4">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-black/25 font-display text-[17px] font-extrabold tracking-tight text-white backdrop-blur-sm"
          >
            {offer.monogram}
          </span>
          <span className="rounded-full bg-black/35 px-3 py-1.5 font-display text-[15px] font-extrabold tracking-tight text-white backdrop-blur-sm tabular-nums">
            −{offer.discountPercent}%
          </span>
        </div>

        <h2 className="relative mt-5 text-[22px] leading-tight text-white">{offer.name}</h2>
        <p className="relative mt-1.5 text-[13.5px] leading-snug text-white/85">{tagline}</p>
      </div>

      {/* --------------------------------- body -------------------------------- */}
      <div className="flex flex-1 flex-col p-6">
        <p className="text-[14px] leading-relaxed text-ink-2">{body}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone="accent">{d.tools.newUsersOnly}</Badge>
          {offer.platforms.map((platform) => (
            <Badge key={platform} tone="neutral">
              {platform}
            </Badge>
          ))}
        </div>

        {/* ------------------------------- the code ----------------------------- */}
        <div className="mt-6 rounded-xl border border-dashed border-line-2 bg-surface-2 p-4">
          <p className="eyebrow">{d.tools.promoCode}</p>
          <div className="mt-2.5 flex items-center gap-3">
            <code
              ref={codeRef}
              className="min-w-0 flex-1 truncate font-mono text-[19px] font-medium tracking-[0.06em] text-ink select-all"
            >
              {offer.code}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? d.tools.codeCopied : d.tools.copyCode}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                copied
                  ? "border-success bg-success-soft text-success"
                  : "border-line-2 bg-surface text-ink-2 hover:border-line-3 hover:text-ink",
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? d.tools.codeCopied : d.tools.copyCode}
            </button>
          </div>
          <p className="mt-3 border-t border-line pt-3 font-mono text-2xs tracking-[0.1em] text-muted uppercase">
            {offer.redeemWindowDays} {d.tools.windowNote}
          </p>
        </div>

        {/* ------------------------------ conditions ---------------------------- */}
        <p className="eyebrow mt-6">{d.tools.conditions}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {terms.map((term) => (
            <li key={term} className="flex gap-2.5 text-[13px] leading-snug text-ink-3">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              {term}
            </li>
          ))}
        </ul>

        <ButtonLink
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="group mt-6"
          full
        >
          {d.tools.openSite}
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden
          />
        </ButtonLink>

        <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">
          {pick(locale, "Оплата на сайте сервиса", "You pay on the partner's site")}
        </p>
      </div>
    </article>
  );
}
