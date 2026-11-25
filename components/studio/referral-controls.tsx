"use client";

import * as React from "react";
import { Link2, Unlink } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import { linkReferral, unlinkReferral } from "@/lib/api/studio-actions";
import type { Locale } from "@/lib/i18n/config";

/** Links a newcomer to whoever brought them, when the link was lost on the way. */
export function LinkReferralForm({ locale }: { locale: Locale }) {
  const { push } = useToast();
  const [referrer, setReferrer] = React.useState("");
  const [referred, setReferred] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await linkReferral(locale, referrer.trim(), referred.trim());
    setBusy(false);
    if (result.ok) {
      push({ tone: "success", title: pick(locale, "Реферал привязан", "Referral linked") });
      setReferrer("");
      setReferred("");
    } else {
      push({ tone: "warning", title: result.message ?? pick(locale, "Не удалось привязать", "Could not link") });
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label={pick(locale, "Кто пригласил", "Who invited")} htmlFor="ref-from">
        <Input id="ref-from" value={referrer} onChange={(event) => setReferrer(event.target.value)} placeholder={pick(locale, "ID, email или AIA-…", "Id, email or AIA-…")} required />
      </Field>
      <Field label={pick(locale, "Кого пригласил", "Who was invited")} htmlFor="ref-to">
        <Input id="ref-to" value={referred} onChange={(event) => setReferred(event.target.value)} placeholder={pick(locale, "ID или email", "Id or email")} required />
      </Field>
      <Button type="submit" loading={busy}>
        <Link2 className="h-4 w-4" aria-hidden />
        {pick(locale, "Привязать", "Link")}
      </Button>
    </form>
  );
}

export function UnlinkReferralButton({ locale, id, label }: { locale: Locale; id: number; label: string }) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState(false);
  async function run() {
    if (!window.confirm(pick(locale, `Отвязать ${label}? Неиспользованный код награды пригласившего выключится.`, `Unlink ${label}? The inviter's unused reward code is switched off.`))) return;
    setBusy(true);
    const result = await unlinkReferral(locale, id);
    setBusy(false);
    push(result.ok ? { tone: "success", title: pick(locale, "Отвязано", "Unlinked") } : { tone: "warning", title: result.message ?? pick(locale, "Не вышло", "Failed") });
  }
  return (
    <Button size="sm" variant="ghost" loading={busy} onClick={run} aria-label={pick(locale, "Отвязать", "Unlink")}>
      <Unlink className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}
