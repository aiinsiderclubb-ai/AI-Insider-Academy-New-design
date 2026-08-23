"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LifeBuoy, Send, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Field, Input, Textarea } from "@/components/primitives/field";
import { EmptyState } from "@/components/primitives/states";
import { useToast } from "@/components/primitives/toast";
import type { Dictionary } from "@/lib/i18n";
import { formatRelative, type Locale } from "@/lib/i18n";

/* ================================== team =================================== */

export interface TeamMember {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
}

export function TeamPanel({
  locale,
  d,
  team,
  members,
}: {
  locale: Locale;
  d: Dictionary;
  team: { id: number; name: string; inviteCode: string; role?: string } | null;
  members: TeamMember[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<"create" | "join" | null>(null);

  async function submit(kind: "create" | "join", event: React.FormEvent) {
    event.preventDefault();
    setBusy(kind);
    try {
      const response = await fetch(`/api/teams/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "create" ? { name } : { inviteCode: code.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { errorRu?: string; error?: string };
      if (!response.ok) throw new Error(payload.errorRu ?? payload.error ?? "");
      push({ tone: "success", title: d.common.saved });
      router.refresh();
    } catch (error) {
      push({ tone: "warning", title: (error as Error).message || d.errors.generic });
    } finally {
      setBusy(null);
    }
  }

  if (team) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border border-line bg-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-[17px]">
              <Users className="h-4 w-4 text-accent" aria-hidden />
              {team.name}
            </h2>
            {team.role && <Badge tone="accent">{team.role}</Badge>}
          </div>

          <ul className="mt-5 flex flex-col divide-y divide-line">
            {members.length ? (
              members.map((member, index) => (
                <li key={member.id ?? index} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{member.name ?? member.email}</p>
                    {member.email && member.name && <p className="truncate text-[12.5px] text-muted">{member.email}</p>}
                  </div>
                  {member.role && <Badge tone="outline">{member.role}</Badge>}
                </li>
              ))
            ) : (
              <li className="py-3 text-[13.5px] text-muted">
                {locale === "en" ? "No members yet." : "Пока никого нет."}
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-accent/35 bg-accent-soft p-6">
          <p className="eyebrow text-accent-ink">{locale === "en" ? "Invite code" : "Код приглашения"}</p>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-3.5 py-2.5">
            <code className="flex-1 font-mono text-[15px] tracking-wider text-ink">{team.inviteCode}</code>
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label={d.common.copy}
              onClick={() => {
                void navigator.clipboard.writeText(team.inviteCode);
                push({ tone: "success", title: d.common.copied });
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
            {locale === "en"
              ? "Share the code with colleagues — they join the team and inherit the courses you grant."
              : "Отправьте код коллегам — они присоединятся к команде и получат курсы, которые вы выдадите."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={(event) => submit("create", event)} className="rounded-lg border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 text-[17px]">
          <Users className="h-4 w-4 text-accent" aria-hidden />
          {locale === "en" ? "Create a team" : "Создать команду"}
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-3">
          {locale === "en"
            ? "For companies that buy access for several people at once."
            : "Для компаний, которые покупают доступ сразу нескольким сотрудникам."}
        </p>
        <Field label={locale === "en" ? "Team name" : "Название команды"} htmlFor="team-name" className="mt-5">
          <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Button type="submit" className="mt-4" loading={busy === "create"} disabled={!name.trim()} full>
          {locale === "en" ? "Create" : "Создать"}
        </Button>
      </form>

      <form onSubmit={(event) => submit("join", event)} className="rounded-lg border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 text-[17px]">
          <UserPlus className="h-4 w-4 text-accent" aria-hidden />
          {locale === "en" ? "Join a team" : "Вступить в команду"}
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-3">
          {locale === "en" ? "Enter the invite code from your team owner." : "Введите код приглашения от владельца команды."}
        </p>
        <Field label={locale === "en" ? "Invite code" : "Код приглашения"} htmlFor="team-code" className="mt-5">
          <Input
            id="team-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            className="font-mono tracking-wider"
            required
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-4" loading={busy === "join"} disabled={!code.trim()} full>
          {locale === "en" ? "Join" : "Вступить"}
        </Button>
      </form>
    </div>
  );
}

/* ================================ referrals ================================ */

export function ReferralPanel({
  locale,
  d,
  link,
  discountPercent,
  friendBonus = 5,
}: {
  locale: Locale;
  d: Dictionary;
  link: string;
  discountPercent: number;
  friendBonus?: number;
}) {
  const { push } = useToast();

  const steps = [
    locale === "en" ? "Copy your link" : "Скопируйте ссылку",
    locale === "en" ? "Send it to a friend" : "Отправьте другу",
    locale === "en" ? "Both of you save" : "Оба получаете выгоду",
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="text-[17px]">{d.app.referrals}</h2>
        <p className="mt-2.5 max-w-lg text-[13.5px] leading-relaxed text-ink-3">
          {locale === "en"
            ? `Your friend gets ${friendBonus}% off their first purchase; you build credit towards your next one.`
            : `Друг получает скидку ${friendBonus}% на первую покупку, вы копите бонус на следующую.`}
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3.5 py-2.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink-2">{link}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              push({ tone: "success", title: d.common.copied });
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {d.common.copy}
          </Button>
        </div>

        <ol className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="bg-surface p-4">
              <span className="font-mono text-[12px] tracking-[0.12em] text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[13.5px] leading-snug text-ink-2">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-accent/35 bg-accent-soft p-6">
        <p className="eyebrow text-accent-ink">{d.checkout.discount}</p>
        <p className="mt-3 font-display text-[3rem] leading-none font-extrabold tabular-nums text-ink">
          {discountPercent}%
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
          {locale === "en"
            ? "Applied automatically at checkout on your next purchase."
            : "Применяется автоматически при следующей покупке."}
        </p>
      </section>
    </div>
  );
}

/* ================================= support ================================= */

export interface SupportMessage {
  id: number;
  body: string;
  fromSupport?: boolean;
  createdAt: string;
}

export function SupportPanel({
  locale,
  d,
  initial,
  telegramUrl,
}: {
  locale: Locale;
  d: Dictionary;
  initial: SupportMessage[];
  telegramUrl: string;
}) {
  const { push } = useToast();
  const [messages, setMessages] = React.useState(initial);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const response = await fetch("/api/me/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.ok) throw new Error();
      setMessages([
        ...messages,
        { id: Date.now(), body: text, fromSupport: false, createdAt: new Date().toISOString() },
      ]);
      setBody("");
      push({ tone: "success", title: locale === "en" ? "Sent" : "Отправлено" });
    } catch {
      push({ tone: "warning", title: d.errors.generic });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="flex flex-col rounded-lg border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 text-[17px]">
          <LifeBuoy className="h-4 w-4 text-accent" aria-hidden />
          {d.app.support}
        </h2>

        {messages.length ? (
          <ul className="mt-5 flex flex-col gap-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.fromSupport
                    ? "max-w-[85%] self-start rounded-lg border border-line bg-surface-2 px-4 py-3"
                    : "max-w-[85%] self-end rounded-lg bg-accent-soft px-4 py-3"
                }
              >
                <p className="text-[13.5px] leading-relaxed text-ink-2">{message.body}</p>
                <p className="mt-1.5 text-[11.5px] text-faint">{formatRelative(message.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            className="mt-5"
            title={locale === "en" ? "Ask us anything" : "Спросите о чём угодно"}
            body={
              locale === "en"
                ? "Access, payments, assignments — the team answers within a working day."
                : "Доступы, оплата, домашние задания — команда отвечает в течение рабочего дня."
            }
          />
        )}

        <form onSubmit={send} className="mt-6">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder={locale === "en" ? "Describe what happened" : "Опишите, что произошло"}
            aria-label={d.app.support}
          />
          <Button type="submit" className="mt-3" loading={sending} disabled={!body.trim()}>
            <Send className="h-4 w-4" aria-hidden />
            {locale === "en" ? "Send" : "Отправить"}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6">
        <p className="eyebrow">Telegram</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
          {locale === "en"
            ? "Prefer a chat? The manager answers in Telegram too."
            : "Удобнее в чате? Менеджер отвечает и в Telegram."}
        </p>
        <Button variant="secondary" className="mt-4" full onClick={() => window.open(telegramUrl, "_blank", "noopener")}>
          {locale === "en" ? "Open Telegram" : "Открыть Telegram"}
        </Button>
        <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-[12.5px] text-muted">
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
          {locale === "en" ? "History stays in your account" : "История остаётся в кабинете"}
        </p>
      </section>
    </div>
  );
}
