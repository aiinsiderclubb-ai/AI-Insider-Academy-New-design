"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Select, Textarea } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import type { ActionResult } from "@/lib/api/studio-actions";
import { pick } from "@/content/locale";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

function useResultToast(locale: Locale, d: Dictionary) {
  const { push } = useToast();
  return (result: ActionResult, success: string) =>
    push(
      result.ok
        ? { tone: "success", title: success }
        : { tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) },
    );
}

/* --------------------------------- orders ---------------------------------- */

/** Takes back what an order gave, after a confirm. Money goes back in the provider's dashboard. */
export function RevokeOrderButton({
  locale,
  d,
  paymentId,
  label,
  onRevoke,
}: {
  locale: Locale;
  d: Dictionary;
  paymentId: string;
  label: string;
  onRevoke: (paymentId: string, reason: string) => Promise<ActionResult>;
}) {
  const toast = useResultToast(locale, d);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    const reason = window.prompt(
      pick(
        locale,
        `Забрать доступ по заказу «${label}»? Деньги вернутся только после возврата в кабинете Paddle. Причина:`,
        `Revoke access for "${label}"? The money is refunded only in the Paddle dashboard. Reason:`,
      ),
      pick(locale, "возврат", "refund"),
    );
    if (reason === null) return;
    setBusy(true);
    toast(await onRevoke(paymentId, reason), pick(locale, "Доступ забран", "Access revoked"));
    setBusy(false);
  }

  return (
    <Button size="sm" variant="ghost" loading={busy} onClick={run}>
      <Undo2 className="h-3.5 w-3.5" aria-hidden />
      {pick(locale, "Забрать доступ", "Revoke")}
    </Button>
  );
}

/* -------------------------------- learners --------------------------------- */

export function GrantForm({
  locale,
  d,
  items,
  onGrant,
}: {
  locale: Locale;
  d: Dictionary;
  items: { id: string; title: string; group: string }[];
  onGrant: (itemId: string, licenseTier: string) => Promise<ActionResult>;
}) {
  const toast = useResultToast(locale, d);
  const [itemId, setItemId] = React.useState("");
  const [tier, setTier] = React.useState("personal");
  const [busy, setBusy] = React.useState(false);
  const groups: Record<string, string> = {
    course: pick(locale, "Курсы", "Courses"),
    pack: pick(locale, "Пакеты курсов", "Course packs"),
    bundle: pick(locale, "Хранилища и наборы", "Vaults and bundles"),
    product: pick(locale, "Товары магазина", "Store products"),
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!itemId) return;
    setBusy(true);
    const result = await onGrant(itemId, tier);
    setBusy(false);
    toast(result, pick(locale, "Доступ выдан", "Access granted"));
    if (result.ok) setItemId("");
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
      <Field label={pick(locale, "Что выдать", "What to grant")} htmlFor="grant-item">
        <Select id="grant-item" value={itemId} onChange={(event) => setItemId(event.target.value)} required>
          <option value="">{pick(locale, "Выберите…", "Choose…")}</option>
          {Object.entries(groups).map(([group, label]) => (
            <optgroup key={group} label={label}>
              {items
                .filter((item) => item.group === group)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field label={pick(locale, "Лицензия", "Licence")} htmlFor="grant-tier">
        <Select id="grant-tier" value={tier} onChange={(event) => setTier(event.target.value)}>
          <option value="personal">personal</option>
          <option value="client">client</option>
          <option value="agency">agency</option>
        </Select>
      </Field>
      <Button type="submit" loading={busy} disabled={!itemId}>
        <Gift className="h-4 w-4" aria-hidden />
        {pick(locale, "Выдать", "Grant")}
      </Button>
    </form>
  );
}

export function RevokeGrantButton({
  locale,
  d,
  label,
  onRevoke,
}: {
  locale: Locale;
  d: Dictionary;
  label: string;
  onRevoke: () => Promise<ActionResult>;
}) {
  const toast = useResultToast(locale, d);
  const [busy, setBusy] = React.useState(false);
  async function run() {
    if (!window.confirm(pick(locale, `Забрать доступ к «${label}»?`, `Revoke access to "${label}"?`))) return;
    setBusy(true);
    toast(await onRevoke(), pick(locale, "Доступ забран", "Access revoked"));
    setBusy(false);
  }
  return (
    <Button size="sm" variant="ghost" loading={busy} onClick={run} aria-label={pick(locale, "Забрать доступ", "Revoke access")}>
      <Undo2 className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}

/** Deleting an account asks for the email typed back: it cannot be undone. */
export function DeleteLearnerButton({
  locale,
  d,
  email,
  backHref,
  onDelete,
}: {
  locale: Locale;
  d: Dictionary;
  email: string;
  backHref: string;
  onDelete: () => Promise<ActionResult>;
}) {
  const toast = useResultToast(locale, d);
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function run() {
    const typed = window.prompt(
      pick(
        locale,
        `Удалить аккаунт навсегда? Покупки, доступы и прогресс пропадут. Введите email для подтверждения: ${email}`,
        `Delete this account for good? Purchases, access and progress are lost. Type the email to confirm: ${email}`,
      ),
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== email.toLowerCase()) {
      toast({ ok: false, message: pick(locale, "Email не совпал — ничего не удалено", "The email did not match — nothing was deleted") }, "");
      return;
    }
    setBusy(true);
    const result = await onDelete();
    setBusy(false);
    toast(result, pick(locale, "Аккаунт удалён", "Account deleted"));
    if (result.ok) router.push(backHref);
  }
  return (
    <Button variant="danger" size="sm" loading={busy} onClick={run}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      {pick(locale, "Удалить аккаунт", "Delete account")}
    </Button>
  );
}

/* --------------------------------- support --------------------------------- */

export function SupportReplyForm({
  locale,
  d,
  existing,
  onReply,
}: {
  locale: Locale;
  d: Dictionary;
  existing?: string | null;
  onReply: (reply: string) => Promise<ActionResult>;
}) {
  const toast = useResultToast(locale, d);
  const [reply, setReply] = React.useState(existing ?? "");
  const [busy, setBusy] = React.useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    toast(await onReply(reply.trim()), pick(locale, "Ответ отправлен", "Reply sent"));
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <Textarea
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        rows={3}
        placeholder={pick(locale, "Ответ клиенту — он увидит его в кабинете, в разделе «Поддержка»", "Reply — the learner sees it in Support in their account")}
        aria-label={pick(locale, "Ответ", "Reply")}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={busy} disabled={!reply.trim()}>
          <Send className="h-3.5 w-3.5" aria-hidden />
          {existing ? pick(locale, "Обновить ответ", "Update reply") : pick(locale, "Ответить", "Reply")}
        </Button>
      </div>
    </form>
  );
}
