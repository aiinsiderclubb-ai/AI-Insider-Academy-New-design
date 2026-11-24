import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Accordion, AccordionItem, Breadcrumbs } from "@/components/primitives/navigation";
import type * as React from "react";
import { ArrowDown, Send, Share2, UserPlus, Users } from "lucide-react";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { GiveawayPanel } from "@/components/community/giveaway-panel";
import { PrizeCard } from "@/components/community/prize-card";
import { chanceValues, giveawayBySlug, giveawayIsOpen, giveawayList } from "@/content/community";
import { pick } from "@/content/locale";
import { links } from "@/content/site";
import { getGiveaway } from "@/lib/api/public";
import { getSession } from "@/lib/api/session";
import { formatDate, getDictionary, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return giveawayList.map((giveaway) => ({ slug: giveaway.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const giveaway = giveawayBySlug(slug);
  if (!giveaway) return {};
  return {
    title: pick(locale as Locale, giveaway.headlineRu, giveaway.headlineEn),
    description: pick(locale as Locale, giveaway.leadRu, giveaway.leadEn),
  };
}

export default async function GiveawayPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const giveaway = giveawayBySlug(slug);
  if (!giveaway) notFound();

  const [live, user] = await Promise.all([getGiveaway(slug), getSession()]);
  const rules = pick(locale, giveaway.rulesRu, giveaway.rulesEn);
  const faq = pick(locale, giveaway.faqRu ?? [], giveaway.faqEn ?? []);
  const base = process.env.SITE_URL ?? links.academy;
  const shareUrl = `${base.replace(/\/$/, "")}/${locale}/community/giveaways/${giveaway.slug}`;
  const endsAt = live?.endsAt ?? giveaway.endsAt;
  const open = giveawayIsOpen(live?.status ?? giveaway.status, endsAt);

  const prize = pick(locale, giveaway.prizeRu, giveaway.prizeEn);
  const drawDate = formatDate(endsAt, locale);
  const journey = [
    {
      icon: UserPlus,
      title: pick(locale, "Аккаунт в Академии", "An Academy account"),
      text: pick(locale, "Бесплатная регистрация — и вы в розыгрыше.", "Sign up for free and you are in the draw."),
      chance: chanceValues.base,
    },
    {
      icon: Send,
      title: pick(locale, "Telegram-канал", "The Telegram channel"),
      text: pick(locale, "Подключите Telegram и подпишитесь на канал AI Insider.", "Connect Telegram and join the AI Insider channel."),
      chance: chanceValues.telegram,
    },
    {
      icon: Users,
      title: pick(locale, "Друзья", "Friends"),
      text: pick(locale, "За каждого друга, пришедшего по вашей ссылке.", "For every friend who joins through your link."),
      chance: chanceValues.referral,
    },
    {
      icon: Share2,
      title: pick(locale, "Поделиться", "Share"),
      text: pick(locale, "Отправьте страницу в соцсети или чат.", "Send the page to a social feed or a chat."),
      chance: chanceValues.share,
    },
  ];

  return (
    <div className="giveaway-page" style={{ "--g-accent": giveaway.accent } as React.CSSProperties}>
      {/* ================================== stage ================================== */}
      <section className="giveaway-stage relative overflow-hidden">
        <span aria-hidden className="giveaway-aurora giveaway-aurora-a" style={{ background: giveaway.accent }} />
        <span aria-hidden className="giveaway-aurora giveaway-aurora-b" />
        <span aria-hidden className="giveaway-stars" />

        <Container size="wide" className="relative pt-8">
          <Breadcrumbs
            label={d.common.breadcrumb}
            items={[
              { label: d.community.giveawaysTitle, href: path("/community/giveaways", locale) },
              { label: prize },
            ]}
          />
        </Container>

        <Container
          size="wide"
          className="relative grid items-center gap-14 pt-10 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-14 lg:pb-28"
        >
          <Reveal>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] uppercase",
                open ? "border-accent/45 bg-accent-soft text-accent-ink" : "border-line-2 bg-surface-2 text-ink-3",
              )}
            >
              <span
                className={cn("relative inline-block h-1.5 w-1.5 rounded-full", open ? "free-start-pulse bg-accent" : "bg-ink-3")}
                aria-hidden
              />
              {open ? pick(locale, giveaway.tagRu, giveaway.tagEn) : pick(locale, "Розыгрыш завершён", "Giveaway finished")}
            </span>

            <h1 className="mt-6 font-display text-[clamp(2.9rem,7vw,5.6rem)] leading-[0.9] font-extrabold tracking-[-0.045em]">
              {pick(locale, "Выиграйте", "Win")}
              <br />
              <span className="giveaway-title-glow">{prize}</span>
            </h1>
            <p className="mt-7 max-w-xl text-[16.5px] leading-relaxed text-ink-2">
              {pick(locale, giveaway.leadRu, giveaway.leadEn)}
            </p>

            <dl className="mt-10 grid max-w-xl gap-px overflow-hidden rounded-2xl border border-line-2 bg-line-2 sm:grid-cols-3">
              <div className="bg-surface/85 p-4 backdrop-blur-sm">
                <dt className="eyebrow">{pick(locale, "Приз", "Prize")}</dt>
                <dd className="mt-2 text-[15px] font-semibold text-ink">
                  {prize} <span className="text-ink-3">{pick(locale, giveaway.prizeDetailRu, giveaway.prizeDetailEn)}</span>
                </dd>
              </div>
              <div className="bg-surface/85 p-4 backdrop-blur-sm">
                <dt className="eyebrow">{pick(locale, "Победителей", "Winners")}</dt>
                <dd className="mt-2 text-[15px] font-semibold text-ink tabular-nums">{giveaway.winnersCount}</dd>
              </div>
              <div className="bg-surface/85 p-4 backdrop-blur-sm">
                <dt className="eyebrow">{pick(locale, "Итоги", "Draw")}</dt>
                <dd className="mt-2 text-[15px] font-semibold text-ink">{drawDate}</dd>
              </div>
            </dl>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ButtonLink href="#enter" size="lg" className="group">
                {open ? pick(locale, "Участвовать", "Enter the draw") : pick(locale, "Смотреть итоги", "See the results")}
                <ArrowDown className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden />
              </ButtonLink>
              <span className="text-[13.5px] text-ink-3">{pick(locale, "Участие бесплатное", "Free to enter")}</span>
            </div>
          </Reveal>

          <Reveal>
            <PrizeCard
              title={giveaway.logoText}
              detail={pick(locale, giveaway.prizeDetailRu, giveaway.prizeDetailEn)}
              eyebrow="AI Insider · Giveaway"
              status={open ? pick(locale, "в игре", "live") : pick(locale, "завершён", "closed")}
              gradient={giveaway.gradient}
              finished={!open}
              footer={[
                { label: pick(locale, "Итоги", "Draw"), value: drawDate },
                { label: pick(locale, "Победителей", "Winners"), value: String(giveaway.winnersCount) },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* ============================ how to enter + panel ============================ */}
      <Container size="wide" className="pt-16 pb-20 lg:pt-20">
        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <Reveal>
              <p className="eyebrow flex items-center gap-3">
                <span className="rule-accent inline-block w-7" aria-hidden />
                {pick(locale, "Шансы", "Chances")}
              </p>
              <h2 className="mt-5 font-display text-[clamp(2rem,4.2vw,3.1rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">
                {pick(locale, "Как увеличить шансы", "How to raise your chances")}
              </h2>
            </Reveal>

            <RevealGroup step={80} className="giveaway-journey relative mt-10 grid gap-3">
              {journey.map(({ icon: Icon, title, text, chance }, index) => (
                <div
                  key={title}
                  className="giveaway-step group relative flex items-center gap-5 rounded-2xl border border-line-2 bg-surface p-5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-accent/45 sm:p-6"
                >
                  <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-3 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-on-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] tracking-[0.16em] text-faint">{String(index + 1).padStart(2, "0")}</p>
                    <p className="mt-1 text-[16px] font-semibold text-ink">{title}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{text}</p>
                  </div>
                  <span className="giveaway-chance shrink-0 rounded-xl px-3 py-2 text-center">
                    <span className="block font-display text-[22px] leading-none font-extrabold tabular-nums">+{chance}</span>
                    <span className="mt-1 block font-mono text-[9.5px] tracking-[0.14em] uppercase opacity-80">
                      {pick(locale, "шанс", "chance")}
                    </span>
                  </span>
                </div>
              ))}
            </RevealGroup>

            <section className="mt-20">
              <Reveal>
                <p className="eyebrow flex items-center gap-3">
                  <span className="rule-accent inline-block w-7" aria-hidden />
                  {d.community.rules}
                </p>
                <h2 className="mt-5 font-display text-[clamp(1.8rem,3.6vw,2.6rem)] leading-[1] font-extrabold tracking-[-0.03em]">
                  {pick(locale, "Честно и прозрачно", "Fair and in the open")}
                </h2>
              </Reveal>
              <RevealGroup step={60} className="mt-8 grid gap-3 sm:grid-cols-2">
                {rules.map((rule, index) => (
                  <div
                    key={rule.title}
                    className="relative overflow-hidden rounded-2xl border border-line-2 bg-surface p-6 transition-[border-color] duration-300 hover:border-accent/40"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-3 -right-1 font-display text-[88px] leading-none font-extrabold text-line-2/70 tabular-nums select-none"
                    >
                      {index + 1}
                    </span>
                    <p className="relative text-[15px] font-semibold text-ink">{rule.title}</p>
                    <p className="relative mt-2 text-[13.5px] leading-relaxed text-ink-3">{rule.text}</p>
                  </div>
                ))}
              </RevealGroup>
            </section>

            {faq.length > 0 && (
              <section className="mt-20">
                <h2 className="mb-5 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em]">
                  {d.learn.faq}
                </h2>
                <Accordion>
                  {faq.map((entry) => (
                    <AccordionItem key={entry.q} name="giveaway-faq" title={entry.q}>
                      {entry.a}
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}
          </div>

          <aside id="enter" className="giveaway-aside scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
            <GiveawayPanel
              locale={locale}
              d={d}
              signedIn={Boolean(user)}
              shareUrl={shareUrl}
              state={{
                slug: giveaway.slug,
                entered: live?.entered ?? false,
                telegramConnected: live?.telegramConnected ?? false,
                channelSubscribed: live?.channelSubscribed ?? false,
                shared: live?.shared ?? false,
                referralCount: live?.referralCount ?? 0,
                chances: live?.chances ?? 0,
                participantCount: live?.participantCount ?? 0,
                endsAt,
                status: open ? "active" : "finished",
                telegramInviteUrl: giveaway.telegramInviteUrl || links.telegramCommunity,
              }}
            />
          </aside>
        </div>
      </Container>
    </div>
  );
}
