import siteLinks from "./data/siteLinks.json";
import legal from "./data/legalEntity.json";
import support from "./data/support.json";
import difficulty from "./data/courseDifficulty.json";
import structure from "./data/productStructure.json";
import creators from "./data/marketplace__creators.json";

/* ------------------------------------ links ------------------------------- */

export const links = {
  academy: siteLinks.ACADEMY_URL,
  mainSite: siteLinks.MAIN_SITE_URL,
  contactEmail: siteLinks.CONTACT_EMAIL,
  telegramCommunity: siteLinks.TELEGRAM_COMMUNITY,
  telegramManager: siteLinks.TELEGRAM_MANAGER,
  telegramNotifyBot: siteLinks.TELEGRAM_NOTIFY_BOT,
  telegramGiveaway: siteLinks.TELEGRAM_GIVEAWAY_CLAUDE,
  support: support.SUPPORT_TELEGRAM_URL,
} as const;

export const ecosystem = siteLinks.PLATFORM_BRIDGE;

/* ------------------------------------ legal ------------------------------- */

export interface LegalEntity {
  draft: boolean;
  legalName: string;
  legalNameEn: string;
  registrationCountry: string;
  registrationNumber: string;
  taxId: string;
  address: string;
  emailClaims: string;
  emailPrivacy: string;
  telegram: string;
  bankName: string;
  iban: string;
  bic: string;
  governingLaw: string;
}

export const legalEntity = legal.LEGAL_ENTITY as LegalEntity;

/**
 * The old platform shipped `TODO:` placeholders straight to the offer page
 * while the checkout was live. Here an unfilled field is detectable, so the
 * page can show an honest "requisites pending" state and Studio can flag it.
 */
export const legalIsDraft =
  legalEntity.draft ||
  Object.values(legalEntity).some((value) => typeof value === "string" && value.startsWith("TODO:"));

export function legalValue(value: string): string | null {
  return value.startsWith("TODO:") ? null : value;
}

/* ---------------------------------- taxonomy ------------------------------ */

export const MENTOR_SURCHARGE_EUR = difficulty.MENTOR_SURCHARGE_EUR as number;

export const DIFFICULTY = difficulty.DIFFICULTY as Record<string, { stars: number; ru: string; en: string }>;

export const difficultyFilters = difficulty.DIFFICULTY_FILTERS as { id: string; ru: string; en: string }[];

export const FREE_COURSE_IDS = structure.FREE_COURSE_IDS as string[];
export const PAID_COURSE_IDS = structure.PAID_COURSE_IDS as string[];
export const PRO_ONLY_COURSE_IDS = structure.PRO_ONLY_COURSE_IDS as string[];
export const CLUB_INCLUDED_PAID_IDS = structure.CLUB_INCLUDED_PAID_IDS as string[];
export const HIDDEN_COURSE_IDS = structure.LEGACY_CATALOG_HIDDEN_IDS as string[];

/* ---------------------------------- creators ------------------------------ */

export interface Creator {
  id: string;
  slug: string;
  name: string;
  bioRu: string;
  bioEn: string;
  avatarGradient: string;
  verified: boolean;
  salesCount: number;
  productCount: number;
  joinedAt: string;
}

export const creatorList = creators.MARKETPLACE_CREATORS as Creator[];
export const revenueShare = creators.CREATOR_REVENUE_SHARE as { creator: number; platform: number };

export function creatorById(id: string): Creator | undefined {
  return creatorList.find((creator) => creator.id === id);
}
