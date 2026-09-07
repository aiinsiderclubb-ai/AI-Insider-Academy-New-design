import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Accordion, AccordionItem, Breadcrumbs } from "@/components/primitives/navigation";
import { Badge } from "@/components/primitives/badge";
import { Container, SectionHead } from "@/components/primitives/surface";
import { GiveawayPanel } from "@/components/community/giveaway-panel";
import { giveawayBySlug, giveawayIsOpen, giveawayList } from "@/content/community";
import { pick } from "@/content/locale";
import { links } from "@/content/site";
import { getGiveaway } from "@/lib/api/public";
import { getSession } from "@/lib/api/session";
import { formatDate, getDictionary, path, type Locale } from "@/lib/i18n";

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

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.community.giveawaysTitle, href: path("/community/giveaways", locale) },
            { label: pick(locale, giveaway.prizeRu, giveaway.prizeEn) },
          ]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-14">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <Badge tone={open ? "accent" : "neutral"}>
              {open ? pick(locale, giveaway.tagRu, giveaway.tagEn) : pick(locale, "Завершён", "Finished")}
            </Badge>

            <h1 className="mt-5 text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
              {pick(locale, giveaway.headlineRu, giveaway.headlineEn)}
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">
              {pick(locale, giveaway.leadRu, giveaway.leadEn)}
            </p>

            <div
              className="mt-8 flex aspect-[16/7] flex-col items-center justify-center rounded-xl"
              style={{ background: giveaway.gradient }}
            >
              <span className="font-display text-[clamp(2rem,6vw,4rem)] font-extrabold tracking-tight text-white/95">
                {giveaway.logoText}
              </span>
              <span className="mt-3 font-mono text-[12px] tracking-[0.18em] text-white/80 uppercase">
                {pick(locale, giveaway.prizeDetailRu, giveaway.prizeDetailEn)}
              </span>
            </div>

            <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
              <div className="bg-surface p-4">
                <dt className="eyebrow">{pick(locale, "Приз", "Prize")}</dt>
                <dd className="mt-2 text-[14px] font-medium text-ink">
                  {pick(locale, giveaway.prizeRu, giveaway.prizeEn)}
                </dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="eyebrow">{pick(locale, "Победителей", "Winners")}</dt>
                <dd className="mt-2 text-[14px] font-medium text-ink tabular-nums">{giveaway.winnersCount}</dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="eyebrow">{pick(locale, "Итоги", "Draw")}</dt>
                <dd className="mt-2 text-[14px] font-medium text-ink">{formatDate(endsAt, locale)}</dd>
              </div>
            </dl>

            <section className="mt-10">
              <SectionHead eyebrow={d.community.rules} title={d.community.rules} as="h2" className="mb-5" />
              <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                {rules.map((rule, index) => (
                  <li key={rule.title} className="bg-surface p-5">
                    <span className="font-mono text-[12px] tracking-[0.12em] text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2.5 text-[14.5px] font-medium text-ink">{rule.title}</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{rule.text}</p>
                  </li>
                ))}
              </ol>
            </section>

            {faq.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-4 text-[19px]">{d.learn.faq}</h2>
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

          <aside className="lg:sticky lg:top-24 lg:self-start">
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
    </>
  );
}
