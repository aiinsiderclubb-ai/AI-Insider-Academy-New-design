import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Ticket } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { EmptyState } from "@/components/primitives/states";
import { giveawayIsOpen, giveawayList } from "@/content/community";
import { pick } from "@/content/locale";
import { getGiveaways } from "@/lib/api/public";
import { formatDate, getDictionary, path, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.community.giveawaysTitle, description: d.community.giveawaysBody };
}

export default async function GiveawaysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const live = await getGiveaways();
  const liveBySlug = new Map(live.map((item) => [item.slug, item]));

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.brand.name, href: path("/", locale) }, { label: d.community.giveawaysTitle }]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-12">
        <p className="eyebrow">{d.community.title}</p>
        <h1 className="mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
          {d.community.giveawaysTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{d.community.giveawaysBody}</p>
      </Container>

      <Container size="wide" className="pb-20">
        {giveawayList.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {giveawayList.map((giveaway) => {
              const state = liveBySlug.get(giveaway.slug);
              const active = giveawayIsOpen(state?.status ?? giveaway.status, state?.endsAt ?? giveaway.endsAt);
              return (
                <li key={giveaway.id}>
                  <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md">
                    <div
                      className="flex aspect-[16/7] items-center justify-center"
                      style={{ background: giveaway.gradient }}
                      aria-hidden
                    >
                      <span className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold tracking-tight text-white/95">
                        {giveaway.logoText}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={active ? "accent" : "neutral"}>
                          {active ? pick(locale, giveaway.tagRu, giveaway.tagEn) : pick(locale, "Завершён", "Finished")}
                        </Badge>
                        <Badge tone="outline">
                          {giveaway.winnersCount} {pick(locale, "победитель", "winner")}
                        </Badge>
                      </div>

                      <h2 className="text-[21px] leading-tight">
                        <Link
                          href={path(`/community/giveaways/${giveaway.slug}`, locale)}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          {pick(locale, giveaway.headlineRu, giveaway.headlineEn)}
                        </Link>
                      </h2>

                      <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-3">
                        {pick(locale, giveaway.leadRu, giveaway.leadEn)}
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-4 pt-3">
                        <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                          <Gift className="h-3.5 w-3.5 text-accent" aria-hidden />
                          {pick(locale, giveaway.prizeRu, giveaway.prizeEn)} {pick(locale, giveaway.prizeDetailRu, giveaway.prizeDetailEn)}
                        </span>
                        <span className="font-mono text-[12px] text-muted">
                          {pick(locale, "до", "until")} {formatDate(giveaway.endsAt, locale, { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Ticket className="h-5 w-5" aria-hidden />}
            title={d.states.emptyTitle}
            body={d.community.giveawaysBody}
            action={
              <ButtonLink href={path("/community/events", locale)} size="sm">
                {d.nav.events}
              </ButtonLink>
            }
          />
        )}
      </Container>
    </>
  );
}
