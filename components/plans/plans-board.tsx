"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Segmented } from "@/components/primitives/field";
import type { Billing, ComparisonRow, MembershipPlan, Tier } from "@/content/plans";
import { formatPrice, path, plural, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PlansBoard({
  locale,
  d,
  monthly,
  annual,
  comparison,
  monthsFreeByTier,
}: {
  locale: Locale;
  d: Dictionary;
  monthly: MembershipPlan[];
  annual: MembershipPlan[];
  comparison: ComparisonRow[];
  monthsFreeByTier: Record<Tier, number>;
}) {
  const [billing, setBilling] = React.useState<Billing>("monthly");
  const plans = billing === "annual" && annual.length ? annual : monthly;

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Segmented
          label={d.plans.title}
          value={billing}
          onChange={setBilling}
          options={[
            { value: "monthly", label: d.plans.monthly },
            { value: "annual", label: d.plans.yearly },
          ]}
        />
        {annual.length > 0 && <Badge tone="success">{d.plans.yearlyNote}</Badge>}
      </div>

      <div className="mt-9 grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const monthlyEquivalent = plan.billing === "annual" ? Math.round(plan.priceEur / 12) : plan.priceEur;
          const reference = monthly.find((item) => item.tier === plan.tier);
          const saved = plan.billing === "annual" && reference ? reference.priceEur * 12 - plan.priceEur : 0;
          // Whole months the yearly price gives away, stated per tier: the
          // badge above the grid can only promise the best case ("up to 6").
          const freeMonths = plan.billing === "annual" ? (monthsFreeByTier[plan.tier] ?? 0) : 0;

          // Some plans encode exclusions inside the includes list; split them
          // out so a missing feature never renders behind a green tick.
          const rawIncludes = locale === "en" ? plan.includesEn : plan.includesRu;
          const isExclusion = (item: string) => /^(не входя|не включ|not included|excludes)/i.test(item.trim());
          const included = rawIncludes.filter((item) => !isExclusion(item));
          const excluded = [
            ...rawIncludes.filter(isExclusion),
            ...(locale === "en" ? (plan.excludesEn ?? []) : (plan.excludesRu ?? [])),
          ];

          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl border bg-surface p-6 shadow-xs sm:p-8",
                plan.tier === "pro" ? "border-accent/45 ring-1 ring-accent/15" : "border-line",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow">{plan.tier === "pro" ? "Pro" : "Club"}</span>
                <Badge tone="accent">
                  {plan.badge
                    ? locale === "en"
                      ? plan.badge.en
                      : plan.badge.ru
                    : plan.tier === "pro"
                      ? d.plans.bestValue
                      : d.plans.mostPopular}
                </Badge>
              </div>

              <h3 className="mt-4 text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">
                {locale === "en" ? plan.nameEn : plan.name}
              </h3>
              {(plan.descRu || plan.descEn) && (
                <p className="mt-3 text-[14px] leading-relaxed text-ink-3">
                  {locale === "en" ? (plan.descEn ?? plan.descRu) : plan.descRu}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-[clamp(2.25rem,4vw,3rem)] leading-none font-extrabold tracking-tight tabular-nums">
                  {formatPrice(plan.priceEur, locale)}
                </span>
                <span className="text-[14px] text-muted">
                  {plan.billing === "annual" ? d.common.perYear : d.common.perMonth}
                </span>
              </div>

              {plan.billing === "annual" && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
                  <span>
                    ≈ {formatPrice(monthlyEquivalent, locale)} {d.common.perMonth}
                  </span>
                  {saved > 0 && <span className="text-success">−{formatPrice(saved, locale)}</span>}
                  {freeMonths > 0 && (
                    <Badge tone="success">
                      {freeMonths}{" "}
                      {plural(freeMonths, locale, [
                        d.plans.monthsFree_1,
                        d.plans.monthsFree_2,
                        d.plans.monthsFree_5,
                      ])}
                    </Badge>
                  )}
                </p>
              )}

              <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-line pt-5">
                {included.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {item}
                  </li>
                ))}
                {excluded.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-snug text-faint">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={path(`/plans/${plan.tier}?billing=${plan.billing}`, locale)}
                variant={plan.tier === "pro" ? "primary" : "secondary"}
                size="lg"
                className="mt-7"
                full
              >
                {locale === "en" ? plan.ctaEn : plan.ctaRu}
              </ButtonLink>

              <p className="mt-3 text-center text-[12px] text-muted">{d.plans.accessNote}</p>
            </article>
          );
        })}
      </div>

      {/* ------------------------------ comparison ------------------------------ */}
      <div className="mt-14">
        <h2 className="text-[clamp(1.5rem,3vw,2.25rem)]">{d.plans.compareTitle}</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-3">{d.plans.body}</p>

        <div className="scroll-x mt-7 rounded-lg border border-line bg-surface shadow-xs">
          <table className="w-full min-w-[36rem] text-[14px]">
            <caption className="sr-only">{d.plans.compareTitle}</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th scope="col" className="p-4 text-left font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                  {d.plans.included}
                </th>
                <th scope="col" className="w-28 p-4 text-center font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                  Club
                </th>
                <th scope="col" className="w-28 p-4 text-center font-mono text-2xs tracking-[0.1em] text-accent-ink uppercase">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.ru} className="border-b border-line last:border-b-0">
                  <th scope="row" className="p-4 text-left font-normal text-ink-2">
                    {locale === "en" ? row.en : row.ru}
                  </th>
                  <td className="p-4 text-center">
                    {row.club ? (
                      <Check className="mx-auto h-4 w-4 text-success" aria-label={d.common.yes} />
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-line-3" aria-label={d.common.no} />
                    )}
                  </td>
                  <td className="bg-accent-soft/40 p-4 text-center">
                    {row.pro ? (
                      <Check className="mx-auto h-4 w-4 text-success" aria-label={d.common.yes} />
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-line-3" aria-label={d.common.no} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
