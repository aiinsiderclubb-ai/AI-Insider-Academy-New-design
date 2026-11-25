"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import { sendMissingWelcomeLetters, sendWelcomeLetter } from "@/lib/api/studio-actions";
import type { Locale } from "@/lib/i18n/config";

export function SendWelcomeButton({ locale, id, again }: { locale: Locale; id: string; again?: boolean }) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState(false);
  async function run() {
    setBusy(true);
    const result = await sendWelcomeLetter(locale, id);
    setBusy(false);
    push(
      result.ok
        ? { tone: "success", title: pick(locale, "Письмо отправлено", "Letter sent") }
        : { tone: "warning", title: result.message === "network" ? pick(locale, "Нет связи", "No connection") : (result.message ?? pick(locale, "Не ушло", "Not sent")) },
    );
  }
  return (
    <Button size="sm" variant={again ? "ghost" : "primary"} loading={busy} onClick={run}>
      <Send className="h-3.5 w-3.5" aria-hidden />
      {again ? pick(locale, "Ещё раз", "Again") : pick(locale, "Отправить", "Send")}
    </Button>
  );
}

export function SendMissingButton({ locale, count }: { locale: Locale; count: number }) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState(false);
  async function run() {
    if (!window.confirm(pick(locale, `Отправить письмо об одобрении всем, кому оно не ушло (${count})?`, `Send the approval letter to everyone who has not had it (${count})?`))) return;
    setBusy(true);
    const result = await sendMissingWelcomeLetters(locale);
    setBusy(false);
    push(
      result.ok
        ? { tone: "success", title: pick(locale, `Отправлено: ${result.sent ?? 0}`, `Sent: ${result.sent ?? 0}`) }
        : { tone: "warning", title: result.message ?? pick(locale, "Не вышло", "Failed") },
    );
  }
  return (
    <Button loading={busy} onClick={run} disabled={!count}>
      <Send className="h-4 w-4" aria-hidden />
      {pick(locale, `Отправить всем, кому не ушло (${count})`, `Send to everyone missing it (${count})`)}
    </Button>
  );
}
