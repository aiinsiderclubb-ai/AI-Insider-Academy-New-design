"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Copy, KeyRound, Mail, Send, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Field, Input, Switch } from "@/components/primitives/field";
import { Tabs } from "@/components/primitives/navigation";
import { Avatar } from "@/components/primitives/display";
import { useToast } from "@/components/primitives/toast";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export interface TelegramState {
  connected: boolean;
  username: string | null;
  botUrl: string;
  botUsername: string;
  prefs: Record<string, boolean>;
}

type Section = "profile" | "email" | "security" | "telegram" | "notifications";

export function SettingsPanels({
  locale,
  d,
  user,
  telegram,
}: {
  locale: Locale;
  d: Dictionary;
  user: { name: string; email: string; personalId: string; avatarUrl?: string | null; emailVerified: boolean };
  telegram: TelegramState;
}) {
  const [section, setSection] = React.useState<Section>("profile");

  const items: { value: Section; label: string }[] = [
    { value: "profile", label: d.auth.name },
    { value: "email", label: d.auth.email },
    { value: "security", label: locale === "en" ? "Security" : "Безопасность" },
    { value: "telegram", label: "Telegram" },
    { value: "notifications", label: d.nav.notifications },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="lg:hidden">
        <Tabs items={items} value={section} onChange={setSection} label={d.app.settings} />
      </div>

      <nav className="hidden lg:block" aria-label={d.app.settings}>
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                onClick={() => setSection(item.value)}
                aria-current={section === item.value ? "true" : undefined}
                className={
                  section === item.value
                    ? "w-full rounded-md bg-accent-soft px-3 py-2 text-left text-[13.5px] font-medium text-accent-ink"
                    : "w-full rounded-md px-3 py-2 text-left text-[13.5px] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
                }
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        {section === "profile" && <ProfilePanel d={d} user={user} />}
        {section === "email" && <EmailPanel d={d} user={user} />}
        {section === "security" && <SecurityPanel d={d} />}
        {section === "telegram" && <TelegramPanel d={d} telegram={telegram} personalId={user.personalId} locale={locale} />}
        {section === "notifications" && <NotificationsPanel d={d} telegram={telegram} locale={locale} />}
      </div>
    </div>
  );
}

/* --------------------------------- profile -------------------------------- */

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="flex items-center gap-2 text-[17px]">
        <Icon className="h-4 w-4 text-accent" aria-hidden />
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfilePanel({
  d,
  user,
}: {
  d: Dictionary;
  user: { name: string; email: string; personalId: string; avatarUrl?: string | null };
}) {
  const { push } = useToast();
  const router = useRouter();
  const [name, setName] = React.useState(user.name);
  const [saving, setSaving] = React.useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error();
      push({ tone: "success", title: d.common.saved });
      router.refresh();
    } catch {
      push({ tone: "warning", title: d.errors.generic });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={d.auth.name} icon={User}>
      <div className="flex items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
          <p className="mt-0.5 font-mono text-[12px] text-muted">{user.personalId}</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 flex flex-col gap-4">
        <Field label={d.auth.name} htmlFor="profile-name">
          <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Button type="submit" loading={saving} className="self-start">
          {d.common.save}
        </Button>
      </form>
    </Card>
  );
}

function EmailPanel({ d, user }: { d: Dictionary; user: { email: string; emailVerified: boolean } }) {
  const { push } = useToast();
  const [email, setEmail] = React.useState(user.email);
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/me/email", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { errorRu?: string; error?: string };
      if (!response.ok) throw new Error(payload.errorRu ?? payload.error ?? "");
      push({ tone: "success", title: d.common.saved });
      setPassword("");
    } catch (error) {
      push({ tone: "warning", title: (error as Error).message || d.errors.generic });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={d.auth.email} icon={Mail}>
      <div className="mb-5 flex items-center gap-2">
        <span className="font-mono text-[13px] text-ink-2">{user.email}</span>
        {user.emailVerified && (
          <Badge tone="success">
            <Check className="h-3 w-3" aria-hidden />
            ok
          </Badge>
        )}
      </div>

      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label={d.auth.email} htmlFor="new-email">
          <Input id="new-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label={d.auth.password} htmlFor="email-password">
          <Input
            id="email-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" loading={saving} disabled={email === user.email} className="self-start">
          {d.common.save}
        </Button>
      </form>
    </Card>
  );
}

function SecurityPanel({ d }: { d: Dictionary }) {
  const { push } = useToast();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as { errorRu?: string; error?: string };
      if (!response.ok) throw new Error(payload.errorRu ?? payload.error ?? "");
      push({ tone: "success", title: d.common.saved });
      setCurrent("");
      setNext("");
    } catch (error) {
      push({ tone: "warning", title: (error as Error).message || d.errors.generic });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={d.auth.password} icon={KeyRound}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label={d.auth.password} htmlFor="current-password">
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
        </Field>
        <Field label={d.auth.passwordRepeat} htmlFor="next-password" hint="8+ · A-z · 0-9">
          <Input
            id="next-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" loading={saving} className="self-start">
          {d.common.save}
        </Button>
      </form>

      <p className="mt-6 flex items-center gap-2 border-t border-line pt-5 text-[12.5px] text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
        {d.checkout.securePayment}
      </p>
    </Card>
  );
}

/* -------------------------------- telegram -------------------------------- */

function TelegramPanel({
  d,
  telegram,
  personalId,
  locale,
}: {
  d: Dictionary;
  telegram: TelegramState;
  personalId: string;
  locale: Locale;
}) {
  const { push } = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/telegram/disconnect", { method: "POST" });
      push({ tone: "success", title: d.common.saved });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Telegram" icon={Send}>
      {telegram.connected ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">
              <Check className="h-3 w-3" aria-hidden />
              {locale === "en" ? "connected" : "подключён"}
            </Badge>
            {telegram.username && <span className="font-mono text-[13px] text-ink-2">@{telegram.username}</span>}
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-3">
            {locale === "en"
              ? "Accepted assignments, promo codes and course news arrive in Telegram."
              : "Принятые задания, промокоды и новости курсов приходят в Telegram."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.open(telegram.botUrl, "_blank", "noopener")}>
              @{telegram.botUsername}
            </Button>
            <Button variant="ghost" onClick={disconnect} loading={busy}>
              {locale === "en" ? "Disconnect" : "Отключить"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13.5px] leading-relaxed text-ink-3">
            {locale === "en"
              ? `Open the bot and send /link ${personalId} to receive notifications.`
              : `Откройте бота и отправьте команду /link ${personalId}, чтобы получать уведомления.`}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3.5 py-2.5">
            <code className="flex-1 font-mono text-[13px] text-ink">/link {personalId}</code>
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label={d.common.copy}
              onClick={() => {
                void navigator.clipboard.writeText(`/link ${personalId}`);
                push({ tone: "success", title: d.common.copied });
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <Button className="mt-4" onClick={() => window.open(telegram.botUrl, "_blank", "noopener")}>
            @{telegram.botUsername}
          </Button>
        </>
      )}
    </Card>
  );
}

/* ------------------------------ notifications ----------------------------- */

const PREF_LABELS: Record<string, { ru: string; en: string }> = {
  homework: { ru: "Домашние задания: принято / доработка", en: "Assignments: accepted or needs rework" },
  promo: { ru: "Промокоды и скидки", en: "Promo codes and discounts" },
  news: { ru: "Новости Academy", en: "Academy news" },
  reviews: { ru: "Статус отзывов", en: "Review status" },
  purchases: { ru: "Покупки и доступ к курсам", en: "Purchases and course access" },
};

function NotificationsPanel({ d, telegram, locale }: { d: Dictionary; telegram: TelegramState; locale: Locale }) {
  const { push } = useToast();
  const [prefs, setPrefs] = React.useState(telegram.prefs);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(key: string, value: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setBusy(key);
    try {
      const response = await fetch("/api/telegram/prefs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setPrefs(previous);
      push({ tone: "warning", title: d.errors.generic });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={d.nav.notifications} icon={Bell}>
      <ul className="flex flex-col gap-4">
        {Object.keys(PREF_LABELS).map((key) => (
          <li key={key}>
            <Switch
              checked={Boolean(prefs[key])}
              disabled={busy === key || !telegram.connected}
              onChange={(event) => toggle(key, event.target.checked)}
              label={locale === "en" ? PREF_LABELS[key].en : PREF_LABELS[key].ru}
            />
          </li>
        ))}
      </ul>
      {!telegram.connected && (
        <p className="mt-5 border-t border-line pt-4 text-[12.5px] text-muted">
          {locale === "en" ? "Connect Telegram to switch these on." : "Подключите Telegram, чтобы включить уведомления."}
        </p>
      )}
    </Card>
  );
}
