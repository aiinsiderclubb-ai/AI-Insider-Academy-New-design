import type { Metadata } from "next";
import { CalendarDays, Radio } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { EmptyState } from "@/components/primitives/states";
import { communityEvents } from "@/content/community";
import { pick } from "@/content/locale";
import { links } from "@/content/site";
import { getCalendar } from "@/lib/api/public";
import { formatDate, getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.community.eventsTitle, description: d.community.eventsBody };
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const scheduled = await getCalendar(locale);

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.brand.name, href: path("/", locale) }, { label: d.community.eventsTitle }]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-12">
        <p className="eyebrow">{d.community.title}</p>
        <h1 className="mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
          {d.community.eventsTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{d.community.eventsBody}</p>
      </Container>

      {scheduled.length > 0 && (
        <Container size="wide" className="pb-14">
          <Reveal>
            <SectionHead
              eyebrow={pick(locale, "В календаре", "On the calendar")}
              title={pick(locale, "Ближайшие эфиры", "Upcoming sessions")}
              as="h2"
            />
          </Reveal>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {scheduled.map((event) => (
              <li key={event.id} className="flex gap-4 bg-surface p-5">
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-surface-2 font-mono text-[11px] leading-none text-ink-2">
                  <span className="text-[16px] font-medium tabular-nums">{new Date(event.date).getDate()}</span>
                  <span className="mt-1 text-faint">
                    {formatDate(event.date, locale, { month: "short" })}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink">{event.title}</p>
                  {event.description && (
                    <p className="mt-1 text-[13px] leading-snug text-ink-3">{event.description}</p>
                  )}
                  <Badge tone="outline" className="mt-2.5">
                    {event.type}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      )}

      <Container size="wide" className="pb-16">
        <Reveal>
          <SectionHead
            eyebrow={pick(locale, "Форматы", "Formats")}
            title={pick(locale, "Что проходит в сообществе", "What runs in the community")}
            as="h2"
          />
        </Reveal>
        {communityEvents.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {communityEvents.map((event) => (
              <li key={event.id} className="rounded-lg border border-line bg-surface p-6">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-accent" aria-hidden />
                  <span className="eyebrow">{pick(locale, event.dateRu, event.dateEn)}</span>
                </div>
                <h3 className="mt-3.5 text-[19px] leading-tight">{pick(locale, event.titleRu, event.titleEn)}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-3">
                  {pick(locale, event.descRu, event.descEn)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" aria-hidden />}
            title={d.states.emptyTitle}
            body={d.community.eventsBody}
          />
        )}
      </Container>

      <Container size="wide" className="pb-20">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-accent/35 bg-accent-soft p-7 sm:p-10">
          <div className="max-w-xl">
            <p className="eyebrow text-accent-ink">Telegram</p>
            <h2 className="mt-3 text-[clamp(1.4rem,2.6vw,2rem)] leading-tight">
              {pick(locale, "Анонсы приходят в канал первыми", "Announcements land in the channel first")}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              {pick(
                locale,
                "Старт эфиров, розыгрыши и итоги — всё в одном канале.",
                "Session starts, giveaways and results — all in one channel.",
              )}
            </p>
          </div>
          <ButtonLink href={links.telegramCommunity} target="_blank" rel="noreferrer noopener" size="lg">
            {pick(locale, "Открыть канал", "Open the channel")}
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
