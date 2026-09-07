"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Copy, Send, Ticket, Users } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button, ButtonLink } from "@/components/primitives/button";
import { useToast } from "@/components/primitives/toast";
import { chanceValues, giveawayIsOpen } from "@/content/community";
import { pick } from "@/content/locale";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export interface GiveawayState {
  slug: string;
  entered: boolean;
  telegramConnected: boolean;
  channelSubscribed: boolean;
  shared: boolean;
  referralCount: number;
  chances: number;
  participantCount: number;
  endsAt: string;
  status: "active" | "finished" | "draft";
  telegramInviteUrl: string;
}

/** Participants are only social proof once there are enough of them. */
const PROOF_THRESHOLD = 25;

function useCountdown(target: string) {
  const [left, setLeft] = React.useState(() => new Date(target).getTime() - Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setLeft(new Date(target).getTime() - Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const clamped = Math.max(0, left);
  return {
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor((clamped % 86_400_000) / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
    over: clamped === 0,
  };
}

export function GiveawayPanel({
  locale,
  d,
  state,
  signedIn,
  shareUrl,
}: {
  locale: Locale;
  d: Dictionary;
  state: GiveawayState;
  signedIn: boolean;
  shareUrl: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const countdown = useCountdown(state.endsAt);
  const closed = !giveawayIsOpen(state.status, state.endsAt) || countdown.over;
  const [busy, setBusy] = React.useState<string | null>(null);

  async function call(action: "enter" | "share" | "verify-telegram") {
    setBusy(action);
    try {
      const response = await fetch(`/api/giveaways/${encodeURIComponent(state.slug)}/${action}`, { method: "POST" });
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

  const units = [
    { value: countdown.days, label: pick(locale, "дн", "d") },
    { value: countdown.hours, label: pick(locale, "ч", "h") },
    { value: countdown.minutes, label: pick(locale, "мин", "m") },
    { value: countdown.seconds, label: pick(locale, "сек", "s") },
  ];

  const bonuses = [
    {
      id: "base",
      value: chanceValues.base,
      title: pick(locale, "Базовое участие", "Base entry"),
      note: pick(locale, "Один шанс за регистрацию в розыгрыше", "One chance for entering"),
      done: state.entered,
      action: !closed && !state.entered && signedIn ? { label: d.community.enterGiveaway, run: () => call("enter") } : null,
    },
    {
      id: "telegram",
      value: chanceValues.telegram,
      title: pick(locale, "Telegram-канал", "Telegram channel"),
      note: pick(locale, "Подписка на канал AI Insider", "Subscribe to the AI Insider channel"),
      done: state.channelSubscribed,
      action: !closed && state.entered
        ? { label: pick(locale, "Проверить подписку", "Check subscription"), run: () => call("verify-telegram") }
        : null,
    },
    {
      id: "referral",
      value: chanceValues.referral,
      title: pick(locale, "Пригласи друга", "Invite a friend"),
      note:
        state.referralCount > 0
          ? `${state.referralCount} × +${chanceValues.referral}`
          : pick(locale, "За каждого друга по вашей ссылке", "For every friend who joins by your link"),
      done: state.referralCount > 0,
      action: null,
    },
    {
      id: "share",
      value: chanceValues.share,
      title: pick(locale, "Поделись страницей", "Share the page"),
      note: pick(locale, "Отправьте ссылку в соцсети или чат", "Post the link to a chat or feed"),
      done: state.shared,
      action:
        !closed && state.entered && !state.shared
          ? {
              label: d.common.share,
              run: async () => {
                await navigator.clipboard.writeText(shareUrl).catch(() => {});
                push({ tone: "success", title: d.common.copied });
                await call("share");
              },
            }
          : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* --------------------------------- status -------------------------------- */}
      <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{closed ? pick(locale, "Итоги", "Results") : pick(locale, "До итогов", "Until the draw")}</p>
          {state.entered && (
            <Badge tone="success">
              <Check className="h-3 w-3" aria-hidden />
              {pick(locale, "вы участвуете", "you are in")}
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {units.map((unit) => (
            <div key={unit.label} className="rounded-md border border-line bg-surface-2 p-2.5 text-center">
              <span className="block font-display text-[1.5rem] leading-none font-extrabold tabular-nums text-ink">
                {String(unit.value).padStart(2, "0")}
              </span>
              <span className="mt-1.5 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{unit.label}</span>
            </div>
          ))}
        </div>

        <dl className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
          <div>
            <dt className="flex items-center gap-1.5 text-[12px] text-muted">
              <Ticket className="h-3.5 w-3.5" aria-hidden />
              {d.community.chances}
            </dt>
            <dd className="mt-1 font-display text-[1.5rem] leading-none font-extrabold tabular-nums text-ink">
              {state.chances}
            </dd>
          </div>
          {state.participantCount >= PROOF_THRESHOLD && (
            <div className="text-right">
              <dt className="flex items-center justify-end gap-1.5 text-[12px] text-muted">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {pick(locale, "участников", "entrants")}
              </dt>
              <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink-2">{state.participantCount}</dd>
            </div>
          )}
        </dl>

        {closed ? (
          <p className="mt-5 rounded-md border border-line bg-surface-2 px-4 py-3 text-center text-[13.5px] leading-relaxed text-ink-2">
            {pick(locale, "Розыгрыш завершён. Новые заявки не принимаем.", "This giveaway has ended. New entries are closed.")}
          </p>
        ) : !signedIn ? (
          <ButtonLink href={path(`/register?next=/community/giveaways/${state.slug}`, locale)} size="lg" className="mt-5" full>
            {d.community.enterGiveaway}
          </ButtonLink>
        ) : !state.entered ? (
          <Button size="lg" className="mt-5" full loading={busy === "enter"} onClick={() => call("enter")}>
            {d.community.enterGiveaway}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            className="mt-5"
            full
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              push({ tone: "success", title: d.common.copied });
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
            {d.common.share}
          </Button>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {closed
            ? pick(locale, "Приём заявок закрыт", "Entry is closed")
            : pick(locale, "Участие бесплатное", "Free to enter")}
        </p>
      </div>

      {/* -------------------------------- bonuses -------------------------------- */}
      <div className="rounded-lg border border-line bg-surface p-5">
        <p className="eyebrow">{pick(locale, "Дополнительные шансы", "Extra chances")}</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {bonuses.map((bonus) => (
            <li
              key={bonus.id}
              className={cn(
                "flex items-start gap-3 rounded-md border p-3.5",
                bonus.done ? "border-success/35 bg-success-soft" : "border-line bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[11px] tabular-nums",
                  bonus.done ? "bg-success text-white" : "bg-surface text-accent-ink",
                )}
              >
                {bonus.done ? <Check className="h-3 w-3" aria-hidden /> : `+${bonus.value}`}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-ink">{bonus.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{bonus.note}</span>
                {bonus.action && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1.5"
                    loading={busy === bonus.id}
                    onClick={() => void bonus.action?.run()}
                  >
                    {bonus.action.label}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {!state.telegramConnected && !closed && (
          <ButtonLink
            href={state.telegramInviteUrl}
            target="_blank"
            rel="noreferrer noopener"
            variant="secondary"
            size="sm"
            className="mt-4"
            full
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {pick(locale, "Открыть канал", "Open the channel")}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
