import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Send } from "lucide-react";
import { ButtonLink } from "@/components/primitives/button";
import { Dot } from "@/components/primitives/badge";
import { Container } from "@/components/primitives/surface";
import { links } from "@/content/site";
import { coursesPublic, plansPublic } from "@/lib/visibility";
import { path, type Locale } from "@/lib/i18n";

/*
 * What every course, lesson and plan address shows while the courses are
 * hidden (lib/visibility.ts). proxy.ts rewrites to it, so the visitor keeps
 * the URL they followed.
 */

const COPY = {
  ru: {
    eyebrow: "Academy · скоро",
    title: "Обучение откроется",
    mark: "совсем скоро",
    body: "Мы собираем программы так, чтобы каждая заканчивалась работающей AI-системой, а не конспектом. Создайте аккаунт сейчас — в день запуска всё откроется прямо в нём.",
    signUp: "Создать аккаунт",
    telegram: "Следить в Telegram",
    store: "А пока — готовые AI-системы в магазине",
  },
  ukr: {
    eyebrow: "Academy · незабаром",
    title: "Навчання відкриється",
    mark: "зовсім скоро",
    body: "Ми збираємо програми так, щоб кожна закінчувалася робочою AI-системою, а не конспектом. Створіть акаунт зараз — у день запуску все відкриється просто в ньому.",
    signUp: "Створити акаунт",
    telegram: "Стежити в Telegram",
    store: "А поки — готові AI-системи в магазині",
  },
  en: {
    eyebrow: "Academy · soon",
    title: "Learning opens",
    mark: "very soon",
    body: "We're building every programme to end in a working AI system, not a set of notes. Create your account now — on launch day everything opens right inside it.",
    signUp: "Create an account",
    telegram: "Follow on Telegram",
    store: "Meanwhile — ready-made AI systems in the store",
  },
} satisfies Record<Locale, Record<string, string>>;

/** For /plans while the subscriptions are hidden but the courses are open. */
const PLANS_COPY = {
  ru: {
    eyebrow: "Club и Pro · скоро",
    title: "Подписки откроются",
    mark: "совсем скоро",
    body: "Club и Pro появятся чуть позже. А курсы уже открыты: покупаете один раз — и он ваш навсегда, без подписки.",
    signUp: "Смотреть курсы",
    telegram: "Следить в Telegram",
    store: "Готовые AI-системы в магазине",
  },
  ukr: {
    eyebrow: "Club і Pro · незабаром",
    title: "Підписки відкриються",
    mark: "зовсім скоро",
    body: "Club і Pro з’являться трохи пізніше. А курси вже відкриті: купуєте один раз — і він ваш назавжди, без підписки.",
    signUp: "Дивитися курси",
    telegram: "Стежити в Telegram",
    store: "Готові AI-системи в магазині",
  },
  en: {
    eyebrow: "Club and Pro · soon",
    title: "Subscriptions open",
    mark: "very soon",
    body: "Club and Pro arrive a little later. The courses are open now: buy one once and it is yours for good, no subscription.",
    signUp: "See the courses",
    telegram: "Follow on Telegram",
    store: "Ready-made AI systems in the store",
  },
} satisfies Record<Locale, Record<string, string>>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ for?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const plans = (await searchParams).for === "plans";
  const copy = (plans ? PLANS_COPY : COPY)[locale as Locale] ?? COPY.ru;
  return { title: `${copy.title} ${copy.mark}`, robots: { index: false, follow: false } };
}

export default async function SoonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const forPlans = (await searchParams).for === "plans";
  if (forPlans && plansPublic()) redirect(path("/plans", locale));
  const showPlans = forPlans && coursesPublic();
  if (!showPlans && coursesPublic()) redirect(path("/learn", locale));
  const copy = (showPlans ? PLANS_COPY[locale] : COPY[locale]) ?? COPY.ru;
  const primaryHref = path(showPlans ? "/learn" : "/register", locale);

  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="animate-drift pointer-events-none absolute -inset-x-40 -top-40 -z-10 h-[46rem]"
        style={{
          background:
            "radial-gradient(40rem 26rem at 70% 30%, color-mix(in oklab, var(--accent) 20%, transparent), transparent 66%), radial-gradient(30rem 20rem at 10% 80%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="hairline-grid pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
      />

      <Container size="wide" className="flex min-h-[78svh] items-center py-24">
        <div className="max-w-3xl animate-rise">
          <p className="eyebrow flex items-center gap-2.5 text-ink-3">
            <Dot pulse />
            {copy.eyebrow}
          </p>
          <h1 className="mt-7 text-[clamp(2.6rem,7vw,5.25rem)] leading-[1.02] tracking-[-0.05em] text-ink">
            {copy.title}
            <br />
            <span className="mark">{copy.mark}</span>
          </h1>
          <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-2">{copy.body}</p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <ButtonLink href={primaryHref} size="lg" className="group">
              {copy.signUp}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
            <ButtonLink href={links.telegramCommunity} variant="secondary" size="lg" target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4" aria-hidden />
              {copy.telegram}
            </ButtonLink>
          </div>

          <Link
            href={path("/store", locale)}
            className="group mt-10 inline-flex items-center gap-2 text-[14px] text-muted transition-colors hover:text-ink"
          >
            {copy.store}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
