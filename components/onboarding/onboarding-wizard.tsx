"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, Check, LineChart, PenTool, Send, Workflow } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button, ButtonLink } from "@/components/primitives/button";
import { Progress } from "@/components/primitives/display";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type TrackId = "agents" | "automation" | "content" | "business";

export interface Recommendation {
  courseSlug: string;
  courseTitle: string;
  courseSummary: string;
  productSlug?: string;
  productTitle?: string;
  productSummary?: string;
  productPrice?: string;
}

interface Choice<T extends string> {
  value: T;
  label: string;
  note: string;
  icon?: React.ElementType;
}

const STORAGE_KEY = "aia-onboarding";

export function OnboardingWizard({
  locale,
  d,
  recommendations,
  telegramUrl,
}: {
  locale: Locale;
  d: Dictionary;
  recommendations: Record<TrackId, Recommendation | null>;
  telegramUrl: string;
}) {
  const ru = locale !== "en";

  const tracks: Choice<TrackId>[] = [
    {
      value: "agents",
      label: "AI Agents",
      note: ru ? "Агенты, оркестрация, голосовые сценарии" : "Agents, orchestration, voice flows",
      icon: Bot,
    },
    {
      value: "automation",
      label: "Automation",
      note: ru ? "n8n, воркфлоу, интеграции с CRM" : "n8n, workflows, CRM integrations",
      icon: Workflow,
    },
    {
      value: "content",
      label: "Content",
      note: ru ? "Промпты, контент-системы, соцсети" : "Prompts, content systems, social",
      icon: PenTool,
    },
    {
      value: "business",
      label: "Business",
      note: ru ? "Оффер, клиенты, AI-агентство" : "Offer, clients, an AI agency",
      icon: LineChart,
    },
  ];

  const levels: Choice<"new" | "some" | "pro">[] = [
    { value: "new", label: ru ? "Только начинаю" : "Just starting", note: ru ? "Пользуюсь ChatGPT изредка" : "I use ChatGPT occasionally" },
    { value: "some", label: ru ? "Есть опыт" : "Some experience", note: ru ? "Собирал что-то своими руками" : "I have built a few things" },
    { value: "pro", label: ru ? "Работаю с клиентами" : "Working with clients", note: ru ? "Хочу продавать внедрение" : "I want to sell implementations" },
  ];

  const paces: Choice<"light" | "steady" | "intense">[] = [
    { value: "light", label: ru ? "2 урока в неделю" : "2 lessons a week", note: ru ? "Спокойный темп" : "An easy pace" },
    { value: "steady", label: ru ? "5 уроков в неделю" : "5 lessons a week", note: ru ? "Рекомендуем" : "Recommended" },
    { value: "intense", label: ru ? "10 уроков в неделю" : "10 lessons a week", note: ru ? "Интенсив" : "Intensive" },
  ];

  const [step, setStep] = React.useState(0);
  const [track, setTrack] = React.useState<TrackId | null>(null);
  const [level, setLevel] = React.useState<(typeof levels)[number]["value"] | null>(null);
  const [pace, setPace] = React.useState<(typeof paces)[number]["value"] | null>(null);

  const steps = [
    { title: ru ? "Какой путь вам нужен?" : "Which path do you want?", body: ru ? "Покажем курс, шаблон и канал под ваше направление." : "We will show a course, a template and a channel for it." },
    { title: ru ? "Насколько вы знакомы с AI?" : "How familiar are you with AI?", body: ru ? "От этого зависит, с какого этапа начинать." : "This decides which stage you start from." },
    { title: ru ? "Сколько времени готовы уделять?" : "How much time can you give it?", body: ru ? "Поставим реалистичную цель на неделю." : "We will set a realistic weekly target." },
  ];

  const total = steps.length;
  const done = step >= total;

  React.useEffect(() => {
    if (!done) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ track, level, pace, at: Date.now() }));
    } catch {
      /* preference storage is optional */
    }
  }, [done, track, level, pace]);

  const recommendation = track ? recommendations[track] : null;

  function pickAndAdvance<T extends string>(setter: (value: T) => void, value: T) {
    setter(value);
    window.setTimeout(() => setStep((current) => current + 1), 160);
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Badge tone="success">
          <Check className="h-3 w-3" aria-hidden />
          {ru ? "Путь собран" : "Path ready"}
        </Badge>

        <h1 className="mt-5 text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.02] tracking-[-0.04em]">
          {ru ? "Ваш маршрут готов" : "Your route is ready"}
        </h1>
        <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
          {ru
            ? "Три шага, чтобы не потеряться: начните с курса, возьмите готовый шаблон и зайдите в сообщество."
            : "Three steps so you don't get lost: start the course, grab a template, join the community."}
        </p>

        <ol className="mt-9 flex flex-col gap-3">
          {recommendation && (
            <li className="rounded-lg border border-accent/35 bg-accent-soft p-5">
              <p className="eyebrow text-accent-ink">01 · {d.nav.catalog}</p>
              <p className="mt-3 text-[18px] font-extrabold tracking-tight text-ink">{recommendation.courseTitle}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{recommendation.courseSummary}</p>
              <ButtonLink href={path(`/learn/${recommendation.courseSlug}`, locale)} className="mt-4">
                {d.common.open}
              </ButtonLink>
            </li>
          )}

          {recommendation?.productSlug && (
            <li className="rounded-lg border border-line bg-surface p-5">
              <p className="eyebrow">02 · {d.store.title}</p>
              <p className="mt-3 text-[18px] font-extrabold tracking-tight text-ink">{recommendation.productTitle}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{recommendation.productSummary}</p>
              <ButtonLink href={path(`/store/${recommendation.productSlug}`, locale)} variant="secondary" className="mt-4">
                {recommendation.productPrice ?? d.common.more}
              </ButtonLink>
            </li>
          )}

          <li className="rounded-lg border border-line bg-surface p-5">
            <p className="eyebrow">03 · Telegram</p>
            <p className="mt-3 text-[18px] font-extrabold tracking-tight text-ink">AI Insider</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{d.community.giveawaysBody}</p>
            <Button variant="secondary" className="mt-4" onClick={() => window.open(telegramUrl, "_blank", "noopener")}>
              <Send className="h-4 w-4" aria-hidden />
              {ru ? "Подписаться" : "Subscribe"}
            </Button>
          </li>
        </ol>

        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href={path("/app", locale)} size="lg" className="group">
            {d.nav.dashboard}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </ButtonLink>
          <ButtonLink href={path("/learn/path", locale)} variant="secondary" size="lg">
            {d.nav.path}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const options =
    step === 0
      ? tracks
      : step === 1
        ? levels
        : paces;
  const selected = step === 0 ? track : step === 1 ? level : pace;
  const setter = step === 0 ? setTrack : step === 1 ? setLevel : setPace;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[12px] tracking-[0.12em] text-muted tabular-nums">
          {String(step + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <Link href={path("/app", locale)} className="text-[13px] text-muted underline-offset-4 hover:text-ink">
          {ru ? "Пропустить" : "Skip"}
        </Link>
      </div>

      <Progress value={((step + 1) / total) * 100} size="sm" className="mt-3" />

      <h1 className="mt-9 text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.02] tracking-[-0.04em]">{steps[step].title}</h1>
      <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-2">{steps[step].body}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = "icon" in option ? option.icon : undefined;
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => pickAndAdvance(setter as (value: string) => void, option.value)}
              className={cn(
                "group flex items-start gap-3.5 rounded-lg border p-5 text-left transition-[transform,border-color,background-color] duration-200",
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-2 hover:shadow-sm",
              )}
            >
              {Icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-accent">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-ink">{option.label}</span>
                <span className="mt-1 block text-[13px] leading-snug text-ink-3">{option.note}</span>
              </span>
              <ArrowRight
                className="ml-auto h-4 w-4 shrink-0 text-line-3 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {step > 0 && (
        <Button variant="ghost" className="mt-7" onClick={() => setStep((current) => current - 1)}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {d.common.back}
        </Button>
      )}
    </div>
  );
}
