import type { Metadata } from "next";
import { Breadcrumbs, Accordion, AccordionItem } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { PlansBoard } from "@/components/plans/plans-board";
import { comparison, monthsFree, plansFor } from "@/content/plans";
import { buyFaq } from "@/content/catalog";
import { pick } from "@/content/locale";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.plans.title, description: d.plans.body };
}

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.brand.name, href: path("/", locale) }, { label: d.plans.title }]}
        />
      </Container>

      <Container size="default" className="pt-9 pb-12 text-center">
        <p className="eyebrow">{d.plans.subtitle}</p>
        <h1 className="mx-auto mt-5 max-w-3xl text-[clamp(2.25rem,5.4vw,3.75rem)] leading-[0.98] tracking-[-0.04em]">
          {pick(locale, "Учитесь и внедряйте в одном доступе", "Learn and ship on a single plan")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{d.plans.body}</p>
      </Container>

      <Container size="wide" className="pb-16">
        <PlansBoard
          locale={locale}
          d={d}
          monthly={plansFor("monthly")}
          annual={plansFor("annual")}
          comparison={comparison}
          monthsFreeByTier={{ club: monthsFree("club"), pro: monthsFree("pro") }}
        />
      </Container>

      <Container size="default" className="pb-16">
        <Note>{d.plans.oneTimeNote}</Note>
      </Container>

      <Container size="default" className="pb-20">
        <h2 className="mb-6 text-[clamp(1.4rem,2.6vw,2rem)]">{d.learn.faq}</h2>
        <Accordion>
          {buyFaq.map((entry) => (
            <AccordionItem key={entry.q} name="plans-faq" title={pick(locale, entry.q, entry.qEn)}>
              {pick(locale, entry.a, entry.aEn)}
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </>
  );
}
