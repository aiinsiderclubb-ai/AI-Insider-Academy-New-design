"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button, ButtonLink } from "@/components/primitives/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/primitives/field";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";
import { ACTIVITY, DIRECTIONS, EXPERIENCE, SOURCES, type Option } from "@/content/application-options";

type Form = {
  firstName: string;
  lastName: string;
  age: string;
  country: string;
  telegram: string;
  email: string;
  currentActivity: string;
  aiExperience: string;
  interests: string[];
  source: string;
  motivation: string;
  futureGoal: string;
};

const EMPTY: Form = {
  firstName: "",
  lastName: "",
  age: "",
  country: "",
  telegram: "",
  email: "",
  currentActivity: "",
  aiExperience: "",
  interests: [],
  source: "",
  motivation: "",
  futureGoal: "",
};

/**
 * The application for «Найди своё в AI».
 *
 * It posts to the API's existing `/applications/accelerator` endpoint, which
 * lands in the Studio queue. Every field it asks for is one the API requires,
 * so the browser checks them first and a person never meets a server error
 * for something they could have been told inline.
 */
export function ApplicationForm({
  locale,
  defaultEmail = "",
  courseHref,
}: {
  locale: Locale;
  defaultEmail?: string;
  courseHref: string;
}) {
  const t = (ru: string, en: string) => pick(locale, ru, en);
  const label = (option: Option) => (locale === "en" ? option.en : option.ru);

  const [form, setForm] = React.useState<Form>({ ...EMPTY, email: defaultEmail });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});
  const [sending, setSending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleInterest(id: string) {
    set(
      "interests",
      form.interests.includes(id) ? form.interests.filter((item) => item !== id) : [...form.interests, id],
    );
  }

  function validate(): boolean {
    const required = t("Обязательное поле", "Required");
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.firstName.trim()) next.firstName = required;
    if (!form.lastName.trim()) next.lastName = required;
    const age = Number(form.age);
    if (!Number.isFinite(age) || age < 14 || age > 100) next.age = t("Возраст от 14 до 100", "Age between 14 and 100");
    if (!form.country.trim()) next.country = required;
    if (!form.telegram.trim()) next.telegram = required;
    if (!form.email.includes("@")) next.email = t("Проверьте email", "Check the email address");
    if (!form.currentActivity) next.currentActivity = required;
    if (!form.aiExperience) next.aiExperience = required;
    if (!form.interests.length) next.interests = t("Выберите хотя бы одно", "Choose at least one");
    if (!form.source) next.source = required;
    if (!form.motivation.trim()) next.motivation = required;
    if (!form.futureGoal.trim()) next.futureGoal = required;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (!validate()) return;
    setSending(true);
    try {
      const response = await fetch("/api/applications/accelerator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, age: Number(form.age) }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setFailure(
          response.status === 400 && payload?.error
            ? t(`Проверьте анкету: ${payload.error}`, `Please check the form: ${payload.error}`)
            : t("Не получилось отправить анкету. Попробуйте ещё раз чуть позже.", "We couldn't send the application. Please try again shortly."),
        );
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFailure(t("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.", "No connection to the server. Check your internet and try again."));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm sm:p-9">
        <p className="flex items-center gap-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-tight text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="h-5 w-5" aria-hidden />
          </span>
          {t("Анкета отправлена", "Application sent")}
        </p>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">
          {t(
            "Спасибо! Куратор прочитает её и ответит на почту. Пока ждёте — посмотрите первый урок, он открыт всем.",
            "Thank you! A curator will read it and reply by email. While you wait, watch the first lesson — it is open to everyone.",
          )}
        </p>
        <ButtonLink href={courseHref} variant="secondary" size="lg" className="mt-7">
          {t("Вернуться к курсу", "Back to the course")}
        </ButtonLink>
      </div>
    );
  }

  const radioGroup = (key: "currentActivity" | "aiExperience", options: Option[]) => (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = form[key] === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => set(key, option.id)}
            className={
              active
                ? "rounded-full border border-accent bg-accent-soft px-3.5 py-1.5 text-[13px] font-medium text-accent-ink"
                : "rounded-full border border-line-2 bg-surface px-3.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-3 hover:text-ink"
            }
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-9">
      {/* ------------------------------- about you ------------------------------ */}
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="eyebrow mb-4 sm:col-span-2">{t("01 · О вас", "01 · About you")}</legend>
        <Field label={t("Имя", "First name")} htmlFor="app-first" error={errors.firstName} required>
          <Input id="app-first" autoComplete="given-name" value={form.firstName} invalid={Boolean(errors.firstName)} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label={t("Фамилия", "Last name")} htmlFor="app-last" error={errors.lastName} required>
          <Input id="app-last" autoComplete="family-name" value={form.lastName} invalid={Boolean(errors.lastName)} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label={t("Возраст", "Age")} htmlFor="app-age" error={errors.age} required>
          <Input id="app-age" type="number" inputMode="numeric" min={14} max={100} value={form.age} invalid={Boolean(errors.age)} onChange={(e) => set("age", e.target.value)} />
        </Field>
        <Field label={t("Страна", "Country")} htmlFor="app-country" error={errors.country} required>
          <Input id="app-country" autoComplete="country-name" value={form.country} invalid={Boolean(errors.country)} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="app-email" error={errors.email} hint={t("Сюда придёт ответ", "We will reply here")} required>
          <Input id="app-email" type="email" autoComplete="email" value={form.email} invalid={Boolean(errors.email)} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Telegram" htmlFor="app-tg" error={errors.telegram} hint="@username" required>
          <Input id="app-tg" value={form.telegram} invalid={Boolean(errors.telegram)} onChange={(e) => set("telegram", e.target.value)} />
        </Field>
      </fieldset>

      {/* ------------------------------ where you are ---------------------------- */}
      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">{t("02 · Где вы сейчас", "02 · Where you are now")}</legend>
        <Field label={t("Чем занимаетесь", "What you do")} error={errors.currentActivity} required>
          <div>{radioGroup("currentActivity", ACTIVITY)}</div>
        </Field>
        <Field label={t("Опыт с AI", "Experience with AI")} error={errors.aiExperience} required>
          <div>{radioGroup("aiExperience", EXPERIENCE)}</div>
        </Field>
        <Field label={t("Какие направления интересны", "Which directions interest you")} error={errors.interests} hint={t("Можно несколько", "Pick as many as you like")} required>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {DIRECTIONS.map((option) => (
              <Checkbox
                key={option.id}
                label={label(option)}
                checked={form.interests.includes(option.id)}
                onChange={() => toggleInterest(option.id)}
              />
            ))}
          </div>
        </Field>
        <Field label={t("Откуда узнали о курсе", "How you heard about the course")} htmlFor="app-source" error={errors.source} required>
          <Select id="app-source" value={form.source} onChange={(e) => set("source", e.target.value)}>
            <option value="" disabled>
              {t("Выберите", "Choose")}
            </option>
            {SOURCES.map((option) => (
              <option key={option.id} value={option.id}>
                {label(option)}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      {/* -------------------------------- in words ------------------------------- */}
      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-4">{t("03 · Своими словами", "03 · In your own words")}</legend>
        <Field label={t("Почему хотите на курс", "Why you want to join")} htmlFor="app-why" error={errors.motivation} hint={t("Пара предложений достаточно", "A couple of sentences is enough")} required>
          <Textarea id="app-why" rows={3} value={form.motivation} invalid={Boolean(errors.motivation)} onChange={(e) => set("motivation", e.target.value)} />
        </Field>
        <Field label={t("Чего хотите добиться через полгода", "Where you want to be in six months")} htmlFor="app-goal" error={errors.futureGoal} required>
          <Textarea id="app-goal" rows={3} value={form.futureGoal} invalid={Boolean(errors.futureGoal)} onChange={(e) => set("futureGoal", e.target.value)} />
        </Field>
      </fieldset>

      {failure && <Note tone="warning">{failure}</Note>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={sending} className="group">
          {sending ? t("Отправляем…", "Sending…") : t("Отправить анкету", "Send application")}
          {!sending && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
        </Button>
        <p className="text-[12.5px] text-muted">
          {t("Ответ придёт на почту.", "We will reply by email.")}
        </p>
      </div>
    </form>
  );
}
