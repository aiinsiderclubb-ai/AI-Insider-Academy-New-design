"use client";

import * as React from "react";
import { Plus, Ticket, Trophy } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Field, Input, Switch } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import type { ActionResult } from "@/lib/api/studio-actions";
import { pick } from "@/content/locale";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/* ------------------------------ feature flags ------------------------------ */

export function FeatureFlagList({
  locale,
  d,
  flags,
  onToggle,
}: {
  locale: Locale;
  d: Dictionary;
  flags: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [state, setState] = React.useState(flags);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(key: string, value: boolean) {
    const previous = state;
    setState({ ...state, [key]: value });
    setBusy(key);
    const result = await onToggle(key, value);
    setBusy(null);
    if (!result.ok) {
      setState(previous);
      push({ tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) });
    } else {
      push({ tone: "success", title: d.common.saved });
    }
  }

  const keys = Object.keys(state);
  if (!keys.length) return <p className="text-[13px] text-muted">{pick(locale, "Флагов нет", "No flags")}</p>;

  return (
    <ul className="flex flex-col gap-4">
      {keys.map((key) => (
        <li key={key}>
          <Switch
            checked={Boolean(state[key])}
            disabled={busy === key}
            onChange={(event) => toggle(key, event.target.checked)}
            label={<span className="font-mono text-[13px]">{key}</span>}
          />
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- promo codes ------------------------------ */

export interface PromoCode {
  code: string;
  percent?: number | null;
  amountEur?: number | null;
  courseId?: string | null;
  maxUses?: number | null;
  usedCount?: number | null;
  active?: boolean | number;
  expiresAt?: string | null;
}

export function PromoManager({
  locale,
  d,
  codes,
  onCreate,
  onToggle,
}: {
  locale: Locale;
  d: Dictionary;
  codes: PromoCode[];
  onCreate: (input: { code: string; percent?: number; maxUses?: number }) => Promise<ActionResult>;
  onToggle: (code: string, active: boolean) => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [code, setCode] = React.useState("");
  const [percent, setPercent] = React.useState("10");
  const [maxUses, setMaxUses] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    const result = await onCreate({
      code: code.trim().toUpperCase(),
      percent: Number(percent) || undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
    });
    setCreating(false);
    if (result.ok) {
      push({ tone: "success", title: pick(locale, "Промокод создан", "Promo code created") });
      setCode("");
      setMaxUses("");
    } else {
      push({ tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) });
    }
  }

  async function toggle(value: string, active: boolean) {
    setBusy(value);
    const result = await onToggle(value, active);
    setBusy(null);
    if (!result.ok) {
      push({ tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={create} className="grid gap-3 rounded-md border border-line bg-surface-2 p-4 sm:grid-cols-[1.2fr_0.7fr_0.7fr_auto] sm:items-end">
        <Field label={pick(locale, "Код", "Code")} htmlFor="promo-code">
          <Input
            id="promo-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="AI2026"
            className="font-mono tracking-wide"
            required
          />
        </Field>
        <Field label="%" htmlFor="promo-percent">
          <Input
            id="promo-percent"
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
          />
        </Field>
        <Field label={pick(locale, "Лимит", "Limit")} htmlFor="promo-uses">
          <Input
            id="promo-uses"
            type="number"
            min={1}
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
            placeholder="∞"
          />
        </Field>
        <Button type="submit" loading={creating} disabled={!code.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          {pick(locale, "Создать", "Create")}
        </Button>
      </form>

      {codes.length ? (
        <ul className="flex flex-col gap-2">
          {codes.map((item) => {
            const active = Boolean(item.active ?? 1);
            return (
              <li
                key={item.code}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3.5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Ticket className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-mono text-[13.5px] font-medium tracking-wide text-ink">{item.code}</span>
                    <span className="block text-[12px] text-muted">
                      {item.percent ? `−${item.percent}%` : item.amountEur ? `−${item.amountEur} €` : "—"}
                      {item.maxUses ? ` · ${item.usedCount ?? 0}/${item.maxUses}` : ""}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={active ? "success" : "neutral"}>
                    {active ? pick(locale, "активен", "active") : pick(locale, "выключен", "off")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === item.code}
                    onClick={() => toggle(item.code, !active)}
                  >
                    {active ? pick(locale, "Выключить", "Disable") : pick(locale, "Включить", "Enable")}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">{pick(locale, "Промокодов нет", "No promo codes yet")}</p>
      )}
    </div>
  );
}

/* -------------------------------- giveaways -------------------------------- */

export function GiveawayControls({
  locale,
  d,
  giveaways,
  onDraw,
  onPublish,
}: {
  locale: Locale;
  d: Dictionary;
  giveaways: { slug: string; title: string; status: string; participants: number }[];
  onDraw: (slug: string) => Promise<ActionResult>;
  onPublish: (slug: string) => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(slug: string, kind: "draw" | "publish") {
    setBusy(`${slug}:${kind}`);
    const result = kind === "draw" ? await onDraw(slug) : await onPublish(slug);
    setBusy(null);
    push(
      result.ok
        ? { tone: "success", title: kind === "draw" ? pick(locale, "Победитель выбран", "Winner drawn") : pick(locale, "Итоги опубликованы", "Results published") }
        : { tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) },
    );
  }

  if (!giveaways.length) return <p className="text-[13px] text-muted">{pick(locale, "Розыгрышей нет", "No giveaways")}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {giveaways.map((giveaway) => (
        <li
          key={giveaway.slug}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3.5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-ink">{giveaway.title}</span>
              <span className="block font-mono text-[12px] text-muted">
                {giveaway.slug} · {giveaway.participants} {pick(locale, "участников", "entrants")}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Badge tone={giveaway.status === "active" ? "accent" : "neutral"}>{giveaway.status}</Badge>
            <Button size="sm" variant="secondary" loading={busy === `${giveaway.slug}:draw`} onClick={() => run(giveaway.slug, "draw")}>
              {pick(locale, "Розыгрыш", "Draw")}
            </Button>
            <Button size="sm" variant="ghost" loading={busy === `${giveaway.slug}:publish`} onClick={() => run(giveaway.slug, "publish")}>
              {pick(locale, "Опубликовать", "Publish")}
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
