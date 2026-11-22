"use client";

import * as React from "react";
import { Plus, Ticket, Trophy } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Checkbox, Field, Input, Segmented, Select, Switch } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import type { ActionResult, PromoInput } from "@/lib/api/studio-actions";
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
  discountPercent?: number | null;
  discountEur?: number | null;
  courseIds?: string[] | null;
  maxUses?: number | null;
  usedCount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
  kind?: "campaign" | "reward";
  createdAt?: string;
}

type PromoState = "active" | "pending" | "expired" | "used" | "off";

function promoState(item: PromoCode, now = Date.now()): PromoState {
  if (!item.active) return "off";
  if (item.maxUses != null && (item.usedCount ?? 0) >= item.maxUses) return "used";
  if (item.validUntil && new Date(item.validUntil).getTime() < now) return "expired";
  if (item.validFrom && new Date(item.validFrom).getTime() > now) return "pending";
  return "active";
}

const STATE_TONE: Record<PromoState, "success" | "accent" | "neutral" | "warning"> = {
  active: "success",
  pending: "accent",
  expired: "neutral",
  used: "neutral",
  off: "warning",
};

export function PromoManager({
  locale,
  d,
  codes,
  items,
  onCreate,
  onToggle,
}: {
  locale: Locale;
  d: Dictionary;
  codes: PromoCode[];
  items: { id: string; title: string; group: string }[];
  onCreate: (input: PromoInput) => Promise<ActionResult>;
  onToggle: (code: string, active: boolean) => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [tab, setTab] = React.useState<"campaign" | "reward">("campaign");
  const [code, setCode] = React.useState("");
  const [kind, setKind] = React.useState<"percent" | "eur">("percent");
  const [amount, setAmount] = React.useState("10");
  const [maxUses, setMaxUses] = React.useState("");
  const [validFrom, setValidFrom] = React.useState("");
  const [validUntil, setValidUntil] = React.useState("");
  const [scope, setScope] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const titles = React.useMemo(() => new Map(items.map((item) => [item.id, item.title])), [items]);
  const shown = codes.filter((item) => (item.kind ?? "campaign") === tab);
  const groupLabel: Record<string, string> = {
    course: pick(locale, "Курсы", "Courses"),
    pack: pick(locale, "Пакеты курсов", "Course packs"),
    bundle: pick(locale, "Хранилища и наборы", "Vaults and bundles"),
    product: pick(locale, "Товары магазина", "Store products"),
  };
  const stateLabel: Record<PromoState, string> = {
    active: pick(locale, "действует", "active"),
    pending: pick(locale, "ещё не начался", "not started"),
    expired: pick(locale, "истёк", "expired"),
    used: pick(locale, "исчерпан", "used up"),
    off: pick(locale, "выключен", "off"),
  };
  const fmt = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "";

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    const value = Number(amount);
    const result = await onCreate({
      code: code.trim().toUpperCase(),
      discountPercent: kind === "percent" ? value : null,
      discountEur: kind === "eur" ? value : null,
      maxUses: maxUses ? Number(maxUses) : null,
      validFrom: validFrom || null,
      validUntil: validUntil ? `${validUntil}T23:59:59.000Z` : null,
      courseIds: scope,
    });
    setCreating(false);
    if (result.ok) {
      push({ tone: "success", title: pick(locale, "Промокод создан", "Promo code created") });
      setCode("");
      setMaxUses("");
      setValidFrom("");
      setValidUntil("");
      setScope([]);
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

  const visibleItems = items.filter((item) => !filter || item.title.toLowerCase().includes(filter.toLowerCase()) || item.id.includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={create} className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
        <div className="grid gap-3 sm:grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr]">
          <Field label={pick(locale, "Код", "Code")} htmlFor="promo-code">
            <Input
              id="promo-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              placeholder="LAUNCH20"
              className="font-mono tracking-wide"
              required
            />
          </Field>
          <Field label={pick(locale, "Скидка", "Discount")} htmlFor="promo-kind">
            <Select id="promo-kind" value={kind} onChange={(event) => setKind(event.target.value as "percent" | "eur")}>
              <option value="percent">%</option>
              <option value="eur">€</option>
            </Select>
          </Field>
          <Field label={kind === "percent" ? "%" : "€"} htmlFor="promo-amount">
            <Input
              id="promo-amount"
              type="number"
              min={kind === "percent" ? 1 : 0.01}
              max={kind === "percent" ? 100 : undefined}
              step={kind === "percent" ? 1 : 0.01}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </Field>
          <Field label={pick(locale, "Лимит", "Limit")} htmlFor="promo-uses">
            <Input id="promo-uses" type="number" min={1} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} placeholder="∞" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={pick(locale, "Действует с", "Valid from")} htmlFor="promo-from">
            <Input id="promo-from" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
          </Field>
          <Field label={pick(locale, "Действует по", "Valid until")} htmlFor="promo-until">
            <Input id="promo-until" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
        </div>

        <details className="rounded-md border border-line bg-surface p-3">
          <summary className="cursor-pointer text-[13px] text-ink-2">
            {scope.length
              ? pick(locale, `Только на выбранное: ${scope.length}`, `Only for selected: ${scope.length}`)
              : pick(locale, "На всё — или выберите курсы и товары", "On everything — or pick courses and products")}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={pick(locale, "Найти…", "Find…")} />
            <div className="max-h-64 overflow-y-auto pr-1">
              {Object.keys(groupLabel).map((group) => {
                const list = visibleItems.filter((item) => item.group === group);
                if (!list.length) return null;
                return (
                  <fieldset key={group} className="mb-3">
                    <legend className="eyebrow mb-1.5">{groupLabel[group]}</legend>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {list.map((item) => (
                        <Checkbox
                          key={item.id}
                          id={`scope-${item.id}`}
                          checked={scope.includes(item.id)}
                          onChange={(event) =>
                            setScope(event.target.checked ? [...scope, item.id] : scope.filter((id) => id !== item.id))
                          }
                          label={<span className="text-[13px]">{item.title}</span>}
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <Button type="submit" loading={creating} disabled={!code.trim() || !amount}>
            <Plus className="h-4 w-4" aria-hidden />
            {pick(locale, "Создать промокод", "Create promo code")}
          </Button>
        </div>
      </form>

      <Segmented
        label={pick(locale, "Какие коды", "Which codes")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "campaign", label: pick(locale, "Кампании", "Campaigns") },
          { value: "reward", label: pick(locale, "Награды (FRIEND, NEXT, THANKS)", "Rewards (FRIEND, NEXT, THANKS)") },
        ]}
      />

      {shown.length ? (
        <ul className="flex flex-col gap-2">
          {shown.slice(0, 100).map((item) => {
            const state = promoState(item);
            const discount = item.discountPercent ? `−${item.discountPercent}%` : item.discountEur ? `−${item.discountEur} €` : "—";
            const scopeText = item.courseIds?.length
              ? item.courseIds.map((id) => titles.get(id) ?? id).slice(0, 3).join(", ") + (item.courseIds.length > 3 ? ` +${item.courseIds.length - 3}` : "")
              : pick(locale, "на всё", "on everything");
            const period = [item.validFrom && `${pick(locale, "с", "from")} ${fmt(item.validFrom)}`, item.validUntil && `${pick(locale, "по", "until")} ${fmt(item.validUntil)}`]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={item.code} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3.5">
                <span className="flex min-w-0 items-center gap-3">
                  <Ticket className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-mono text-[13.5px] font-medium tracking-wide text-ink">{item.code}</span>
                    <span className="block text-[12px] text-muted">
                      {discount} · {scopeText} · {item.usedCount ?? 0}
                      {item.maxUses != null ? `/${item.maxUses}` : ""} {pick(locale, "исп.", "used")}
                      {period ? ` · ${period}` : ""}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={STATE_TONE[state]}>{stateLabel[state]}</Badge>
                  <Button size="sm" variant="ghost" loading={busy === item.code} onClick={() => toggle(item.code, !item.active)}>
                    {item.active ? pick(locale, "Выключить", "Disable") : pick(locale, "Включить", "Enable")}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">
          {tab === "campaign"
            ? pick(locale, "Промокодов кампаний пока нет", "No campaign codes yet")
            : pick(locale, "Коды наград появятся после первых покупок и отзывов", "Reward codes appear after the first purchases and reviews")}
        </p>
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
