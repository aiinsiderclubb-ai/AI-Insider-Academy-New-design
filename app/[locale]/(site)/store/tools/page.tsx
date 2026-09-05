import type { Metadata } from "next";
import { Info, LifeBuoy } from "lucide-react";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { EmptyState } from "@/components/primitives/states";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { PartnerCard } from "@/components/store/partner-card";
import { activeOffers } from "@/content/partners";
import { getDictionary, locales, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.tools.title, description: d.tools.body };
}

/**
 * Partner tools.
 *
 * A shelf of other people's services, not Academy's. The page says that three
 * times over — in the lead, in the disclosure, and on every card — because the
 * failure mode here is a learner assuming Academy can fix a charge it never
 * took, and finding out only once something has gone wrong.
 */
export default async function ToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const offers = activeOffers();

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.store.title, href: path("/store", locale) }, { label: d.nav.tools }]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-12">
        <Reveal>
          <p className="eyebrow">{d.tools.subtitle}</p>
          <h1 className="mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
            {d.tools.title}
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{d.tools.body}</p>
        </Reveal>
      </Container>

      <Container size="wide" className="pb-14">
        {offers.length ? (
          <RevealGroup
            step={80}
            className={cn(
              // The shelf grows with the list instead of stretching one card
              // across three columns of empty paper.
              "grid gap-4",
              offers.length === 1 && "max-w-md",
              offers.length === 2 && "sm:grid-cols-2",
              offers.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {offers.map((offer) => (
              <PartnerCard key={offer.id} offer={offer} locale={locale} d={d} />
            ))}
          </RevealGroup>
        ) : (
          <EmptyState title={d.tools.empty} />
        )}
      </Container>

      {/* ------------------------------ small print ----------------------------- */}
      <Container size="wide" className="pb-24">
        <Reveal>
          <div className="grid gap-4 rounded-2xl border border-line bg-surface-2 p-6 sm:grid-cols-2 sm:p-8">
            <div className="flex gap-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium text-ink">{d.tools.disclosureTitle}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{d.tools.disclosureBody}</p>
              </div>
            </div>
            <div className="flex gap-4 border-line sm:border-l sm:pl-8">
              <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium text-ink">{d.nav.support}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{d.tools.supportNote}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
