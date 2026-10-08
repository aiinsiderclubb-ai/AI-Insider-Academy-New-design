"use client";

import * as React from "react";
import { Check, Copy, Star } from "lucide-react";
import { Button, ButtonLink } from "@/components/primitives/button";
import { Field, Textarea } from "@/components/primitives/field";
import { Note } from "@/components/primitives/states";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Reward {
  code: string;
  validUntil: string | null;
}

/**
 * The review a buyer writes, and the promo code they get for it.
 *
 * The code is shown the moment the review is accepted rather than only
 * emailed: the person is here now, and a reward that arrives "in a few
 * minutes, check spam" is a reward half the people never see.
 */
export function ReviewForm({
  item,
  spendHref,
  dateLocale,
  d,
}: {
  item: { id: string; title: string };
  spendHref: string;
  dateLocale: string;
  d: Dictionary;
}) {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reward, setReward] = React.useState<Reward | null>(null);
  const [done, setDone] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!rating || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim() }),
      });
      if (response.status === 403) {
        setError(d.review.notOwned);
        return;
      }
      if (!response.ok) throw new Error("failed");
      const payload = (await response.json()) as { reward?: Reward | null };
      setReward(payload.reward ?? null);
      setDone(true);
    } catch {
      setError(d.review.failed);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const until = reward?.validUntil ? new Date(reward.validUntil) : null;
    return (
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
        <p className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="h-4 w-4" aria-hidden />
          </span>
          {d.review.thanksTitle}
        </p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-3">{d.review.thanksBody}</p>

        {reward && (
          <div className="mt-6 rounded-lg border border-dashed border-accent bg-accent-soft p-5 text-center">
            <p className="eyebrow">{d.review.code}</p>
            <p className="mt-3 font-mono text-[clamp(1.3rem,5vw,1.9rem)] font-bold tracking-[0.12em] text-ink">
              {reward.code}
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(reward.code).then(
                  () => setCopied(true),
                  () => {},
                );
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              <span aria-live="polite">{copied ? d.common.copied : d.common.copy}</span>
            </button>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
              {until && !Number.isNaN(until.getTime()) && (
                <>
                  {d.review.validUntil}{" "}
                  {until.toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })},{" "}
                  {d.review.oneUse}.{" "}
                </>
              )}
              {d.review.howTo}
            </p>
          </div>
        )}

        <ButtonLink href={spendHref} className="mt-6">
          {d.review.spend}
        </ButtonLink>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <p className="eyebrow">{d.review.about}</p>
      <p className="mt-2 font-display text-lg font-extrabold tracking-tight text-ink">{item.title}</p>

      <fieldset className="mt-7">
        <legend className="text-[13.5px] font-medium text-ink-2">{d.review.rating}</legend>
        <div className="mt-2.5 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} ${d.review.stars}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              className="rounded-md p-1.5 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  value <= shown ? "fill-accent text-accent" : "text-line-3",
                )}
                aria-hidden
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 font-mono text-[12.5px] text-muted">
              {rating} {d.review.stars}
            </span>
          )}
        </div>
      </fieldset>

      <div className="mt-6">
        <Field label={d.review.text} htmlFor="review-text">
          <Textarea
            id="review-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            placeholder={d.review.textPlaceholder}
            required
          />
        </Field>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted">{d.review.honest}</p>

      {error && (
        <Note tone="warning" className="mt-4">
          {error}
        </Note>
      )}

      <Button type="submit" className="mt-6" loading={sending} disabled={!rating || !text.trim()} full>
        {d.review.submit}
      </Button>
    </form>
  );
}
