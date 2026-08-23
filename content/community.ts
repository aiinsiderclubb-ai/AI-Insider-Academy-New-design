import giveaways from "./data/giveaways.json";
import events from "./data/events.json";
import chances from "./data/giveawayChances.json";
import challenges from "./data/challenges.json";

export interface GiveawayRule {
  title: string;
  text: string;
}

export interface GiveawayContent {
  id: string;
  slug: string;
  status: "active" | "finished" | "draft";
  brand: string;
  icon: string;
  logoText: string;
  accent: string;
  gradient: string;
  prizeRu: string;
  prizeEn: string;
  prizeDetailRu: string;
  prizeDetailEn: string;
  winnersCount: number;
  startsAt: string;
  endsAt: string;
  telegramChannel: string;
  telegramInviteUrl: string;
  telegramPostUrl: string;
  tagRu: string;
  tagEn: string;
  headlineRu: string;
  headlineEn: string;
  leadRu: string;
  leadEn: string;
  rulesRu: GiveawayRule[];
  rulesEn: GiveawayRule[];
  faqRu?: { q: string; a: string }[];
  faqEn?: { q: string; a: string }[];
}

export const giveawayList = giveaways.GIVEAWAYS as unknown as GiveawayContent[];

export function giveawayBySlug(slug: string) {
  return giveawayList.find((giveaway) => giveaway.slug === slug);
}

/** Ways to earn extra entries, and how many each is worth. */
export const chanceValues = {
  base: chances.CHANCE_BASE as number,
  telegram: chances.CHANCE_TELEGRAM as number,
  referral: chances.CHANCE_REFERRAL as number,
  share: chances.CHANCE_SHARE as number,
};

export interface CommunityEvent {
  id: string;
  slug: string;
  status: string;
  icon: string;
  accent: string;
  titleRu: string;
  titleEn: string;
  dateRu: string;
  dateEn: string;
  descRu: string;
  descEn: string;
  link: string | null;
}

export const communityEvents = events.COMMUNITY_EVENTS as unknown as CommunityEvent[];

export const weeklyChallenges = challenges as Record<string, unknown>;
