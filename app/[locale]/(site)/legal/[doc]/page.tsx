import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { legalDocument, legalSlugs } from "@/content/legal";
import { legalEntity, legalIsDraft, legalValue } from "@/content/site";
import { pick } from "@/content/locale";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export function generateStaticParams() {
  return legalSlugs.map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const document = legalDocument(doc);
  if (!document) return {};
  return { title: document.title, description: document.subtitle };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale: raw, doc } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const document = legalDocument(doc);
  if (!document) notFound();

  const requisites: { label: string; value: string | null }[] = [
    { label: pick(locale, "Продавец", "Seller"), value: legalValue(legalEntity.legalName) },
    { label: pick(locale, "Страна", "Country"), value: legalValue(legalEntity.registrationCountry) },
    { label: pick(locale, "Регистрация", "Registration"), value: legalValue(legalEntity.registrationNumber) },
    { label: pick(locale, "Налоговый номер", "Tax ID"), value: legalValue(legalEntity.taxId) },
    { label: pick(locale, "Адрес", "Address"), value: legalValue(legalEntity.address) },
    { label: "IBAN", value: legalValue(legalEntity.iban) },
    { label: pick(locale, "Применимое право", "Governing law"), value: legalValue(legalEntity.governingLaw) },
  ];

  return (
    <Container size="narrow" className="pt-8 pb-20">
      <Breadcrumbs
        label={d.common.breadcrumb}
        items={[{ label: d.brand.name, href: path("/", locale) }, { label: document.title }]}
      />

      <h1 className="mt-7 text-[clamp(2rem,4.6vw,3rem)] leading-[1.03] tracking-[-0.04em]">{document.title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{document.subtitle}</p>

      {legalIsDraft && (
        <Note tone="warning" className="mt-7">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            {pick(
              locale,
              "Реквизиты продавца ещё не заполнены. До их публикации боевые платежи отключены — оплата возможна только после завершения оформления.",
              "The seller's registration details are not filled in yet. Live payments stay switched off until they are published.",
            )}
          </span>
        </Note>
      )}

      {/* table of contents — a legal page is scanned, not read start to finish */}
      <nav aria-label={d.common.breadcrumb} className="mt-9 rounded-lg border border-line bg-surface-2 p-5">
        <p className="eyebrow mb-3">{pick(locale, "Содержание", "Contents")}</p>
        <ol className="flex flex-col gap-1.5">
          {document.sections.map((section) => (
            <li key={section.id}>
              <Link href={`#${section.id}`} className="text-[13.5px] text-ink-2 underline-offset-4 hover:text-accent-ink hover:underline">
                {section.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 flex flex-col gap-9">
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-[19px] leading-snug">{section.title}</h2>
            <div className="mt-3.5 flex flex-col gap-3">
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-[14.5px] leading-relaxed text-ink-2">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.items && section.items.length > 0 && (
              <ul className="mt-3.5 flex flex-col gap-2 border-l-2 border-line pl-5">
                {section.items.map((item) => (
                  <li key={item} className="text-[14px] leading-relaxed text-ink-3">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-lg border border-line bg-surface p-6">
        <h2 className="text-[17px]">{pick(locale, "Реквизиты", "Registration details")}</h2>
        <dl className="mt-4 flex flex-col divide-y divide-line">
          {requisites.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
              <dt className="text-[13px] text-muted">{row.label}</dt>
              <dd className={row.value ? "text-[13.5px] text-ink-2" : "text-[13px] text-warning"}>
                {row.value ?? pick(locale, "не заполнено", "not provided")}
              </dd>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
            <dt className="text-[13px] text-muted">Email</dt>
            <dd className="text-[13.5px] text-ink-2">{legalEntity.emailClaims}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
            <dt className="text-[13px] text-muted">Telegram</dt>
            <dd className="text-[13.5px] text-ink-2">{legalEntity.telegram}</dd>
          </div>
        </dl>
      </section>
    </Container>
  );
}
