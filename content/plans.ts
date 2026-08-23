import memberships from "./data/memberships.json";
import details from "./data/membershipDetails.json";
import club from "./data/club.json";

export type Tier = "club" | "pro";

export interface MembershipPlan {
  id: string;
  name: string;
  nameEn: string;
  priceEur: number;
  periodRu: string;
  periodEn: string;
  billing: "monthly" | "annual";
  tier: Tier;
  badge?: { ru: string; en: string };
  featured?: boolean;
  ctaRu: string;
  ctaEn: string;
  descRu?: string;
  descEn?: string;
  includesRu: string[];
  includesEn: string[];
  excludesRu?: string[];
  excludesEn?: string[];
  oldPriceEur?: number;
  noteRu?: string;
  noteEn?: string;
}

export const membershipPlans = memberships.MEMBERSHIP_PLANS as unknown as MembershipPlan[];
export const membershipsTitle = memberships.MEMBERSHIPS_TITLE as { ru: string; en: string };
export const clubMembershipIds = memberships.CLUB_MEMBERSHIP_IDS as string[];
export const proMembershipIds = memberships.PRO_MEMBERSHIP_IDS as string[];
export const allMembershipIds = memberships.ALL_MEMBERSHIP_IDS as string[];

export const membershipDetails = details as Record<string, unknown>;
export const clubContent = club as Record<string, unknown>;

export type Billing = "monthly" | "annual";

export function plansFor(billing: Billing): MembershipPlan[] {
  const matching = membershipPlans.filter((plan) => plan.billing === billing);
  return matching.length ? matching : membershipPlans.filter((plan) => plan.billing === "monthly");
}

/** Whole months saved by paying for a year up front. */
export function monthsFree(tier: Tier): number {
  const monthly = planByTier(tier, "monthly");
  const annual = planByTier(tier, "annual");
  if (!monthly || !annual) return 0;
  return Math.max(0, Math.round((monthly.priceEur * 12 - annual.priceEur) / monthly.priceEur));
}

export function planById(id: string): MembershipPlan | undefined {
  return membershipPlans.find((plan) => plan.id === id);
}

export function planByTier(tier: Tier, billing: Billing = "monthly"): MembershipPlan | undefined {
  return plansFor(billing).find((plan) => plan.tier === tier);
}

/**
 * Feature matrix behind the Club/Pro comparison. Kept as data so the table and
 * the plan cards can never disagree about what a tier includes.
 */
export interface ComparisonRow {
  ru: string;
  en: string;
  club: boolean;
  pro: boolean;
}

export const comparison: ComparisonRow[] = [
  { ru: "Все обычные видеоуроки Academy", en: "All standard Academy video lessons", club: true, pro: true },
  { ru: "Учебные материалы доступных курсов", en: "Course materials for included programmes", club: true, pro: true },
  { ru: "Домашние задания и сертификаты", en: "Assignments and certificates", club: true, pro: true },
  { ru: "Новые базовые курсы внутри Academy", en: "New core courses inside Academy", club: true, pro: true },
  { ru: "Закрытое сообщество в Telegram", en: "Private Telegram community", club: true, pro: true },
  { ru: "Промпт-библиотека и чек-листы", en: "Prompt library and checklists", club: true, pro: true },
  {
    ru: "Pro-only: Automation, Agent и Business Builder",
    en: "Pro-only: Automation, Agent and Business Builder",
    club: false,
    pro: true,
  },
  { ru: "Готовые n8n workflow", en: "Ready-made n8n workflows", club: false, pro: true },
  { ru: "Шаблоны AI-агентов, ботов и voice agents", en: "AI agent, bot and voice agent templates", club: false, pro: true },
  { ru: "Скрипты продаж и outreach для клиентов", en: "Sales and outreach scripts for client work", club: false, pro: true },
  { ru: "Ежемесячные разборы кейсов", en: "Monthly case teardowns", club: false, pro: true },
  { ru: "Премиальные кейсы и ресурсы для AI-бизнеса", en: "Premium cases and AI business resources", club: false, pro: true },
];
