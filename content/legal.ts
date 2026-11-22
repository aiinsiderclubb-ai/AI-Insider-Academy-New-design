import legal from "./data/legal.json";
import type { Locale } from "@/lib/i18n";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  subtitle: string;
  sections: LegalSection[];
}

interface Meta {
  title: string;
  subtitle: string;
}

/** Russian text, and an English one where it exists; Ukrainian readers get the Russian. */
const DOCS = {
  offer: { ru: legal.offer, ruMeta: legal.offerMeta, en: legal.offerEn, enMeta: legal.offerEnMeta },
  privacy: { ru: legal.privacy, ruMeta: legal.privacyMeta, en: legal.privacyEn, enMeta: legal.privacyEnMeta },
  refund: { ru: legal.refund, ruMeta: legal.refundMeta, en: legal.refundEn, enMeta: legal.refundEnMeta },
  impressum: { ru: legal.impressum, ruMeta: legal.impressumMeta, en: legal.impressumEn, enMeta: legal.impressumEnMeta },
  "giveaway-rules": { ru: legal.giveawayRules, ruMeta: legal.giveawayRulesMeta, en: null, enMeta: null },
} as const;

/** Other addresses people (and payment providers' reviewers) try for the same document. */
const ALIASES: Record<string, keyof typeof DOCS> = { terms: "offer", refunds: "refund" };

export type LegalSlug = keyof typeof DOCS;

export const legalSlugs = [...Object.keys(DOCS), ...Object.keys(ALIASES)];

export function legalDocument(slug: string, locale: Locale = "ru"): LegalDocument | null {
  const key = (ALIASES[slug] ?? slug) as LegalSlug;
  const entry = DOCS[key];
  if (!entry) return null;
  const english = locale === "en" && entry.en;
  const meta = (english ? entry.enMeta : entry.ruMeta) as Meta | null;
  return {
    slug: key,
    title: meta?.title ?? key,
    subtitle: meta?.subtitle ?? "",
    sections: ((english ? entry.en : entry.ru) ?? []) as unknown as LegalSection[],
  };
}
