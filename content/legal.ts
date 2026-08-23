import legal from "./data/legal.json";

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

const DOCS = {
  offer: { data: legal.offer, meta: legal.offerMeta },
  privacy: { data: legal.privacy, meta: legal.privacyMeta },
  refund: { data: legal.refund, meta: legal.refundMeta },
  "giveaway-rules": { data: legal.giveawayRules, meta: legal.giveawayRulesMeta },
} as const;

export type LegalSlug = keyof typeof DOCS;

export const legalSlugs = Object.keys(DOCS) as LegalSlug[];

export function legalDocument(slug: string): LegalDocument | null {
  const entry = DOCS[slug as LegalSlug];
  if (!entry) return null;
  return {
    slug,
    title: entry.meta?.title ?? slug,
    subtitle: entry.meta?.subtitle ?? "",
    sections: (entry.data ?? []) as unknown as LegalSection[],
  };
}
