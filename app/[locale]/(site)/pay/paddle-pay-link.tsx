"use client";

import * as React from "react";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";
import { loadPaddle, paddleConfigured } from "@/lib/paddle-client";

export function PaddlePayLink({ locale }: { locale: Locale }) {
  const [state, setState] = React.useState<"opening" | "missing" | "failed">("opening");

  React.useEffect(() => {
    const hasTransaction = new URLSearchParams(window.location.search).has("_ptxn");
    if (!hasTransaction || !paddleConfigured()) {
      setState("missing");
      return;
    }
    loadPaddle().catch(() => setState("failed"));
  }, []);

  const text = {
    opening: pick(locale, "Открываем безопасное окно оплаты Paddle…", "Opening Paddle's secure checkout…"),
    missing: pick(locale, "Ссылка на оплату неполная. Вернитесь на страницу товара и нажмите «Оплатить» ещё раз.", "This payment link is incomplete. Go back to the product and press Pay again."),
    failed: pick(locale, "Не удалось загрузить окно оплаты. Проверьте блокировщик рекламы и обновите страницу.", "The checkout did not load. Check your ad blocker and reload the page."),
  }[state];

  return (
    <output className="mt-5 block text-[15px] leading-relaxed text-ink-2">
      {text}
    </output>
  );
}
