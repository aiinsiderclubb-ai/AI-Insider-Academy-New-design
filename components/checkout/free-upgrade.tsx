"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { pick } from "@/content/locale";
import { upgradePlanFree } from "@/lib/api/plan-actions";
import type { Locale } from "@/lib/i18n/config";

/** The launch offer for someone already on self-study: the mentor plan, free. */
export function FreeUpgrade({
  locale,
  courseId,
  studyHref,
  hoursLeft,
}: {
  locale: Locale;
  courseId: string;
  studyHref: string;
  hoursLeft: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const result = await upgradePlanFree(locale, courseId);
    setBusy(false);
    if (result.ok) router.push(studyHref);
    else setError(result.message === "network" ? pick(locale, "Нет связи — попробуйте ещё раз.", "No connection — try again.") : (result.message ?? null));
  }

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent-soft p-6">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        {pick(locale, "Тариф с ментором — бесплатно", "The mentor plan — free")}
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
        {pick(
          locale,
          `Пока идёт запуск, тариф с ментором стоит столько же, сколько самостоятельный. Вы его уже оплатили — переходите без доплаты. Осталось ${hoursLeft} ч.`,
          `During the launch the mentor plan costs the same as self-study, which you have paid — move up at no charge. ${hoursLeft} h left.`,
        )}
      </p>
      <Button className="mt-4 w-full" loading={busy} onClick={run}>
        {pick(locale, "Перейти на тариф с ментором", "Move up to the mentor plan")}
      </Button>
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
