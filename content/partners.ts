/**
 * Partner tools — third-party services students get a discount on.
 *
 * Kept apart from `content/store.ts` on purpose. Marketplace products are
 * things Academy sells and supports; these are other people's services, paid
 * for elsewhere, and the platform's only role is the code and the link. Mixing
 * the two would make a support request about someone else's billing land here.
 *
 * Every entry is an affiliate placement — the deal that gets Academy the
 * discount is the same deal that pays a referral. `disclosure` on the page
 * says so out loud rather than burying it, because a learner deciding whether
 * to trust a recommendation is owed that.
 *
 * Copy is only what the partner actually states about itself. No invented
 * model names, no numbers nobody published.
 */

export interface PartnerOffer {
  id: string;
  /** Shown as the card's title. */
  name: string;
  /** Two-letter mark drawn in the tile when there is no logo file. */
  monogram: string;
  /** Tailwind-safe gradient for the tile. */
  gradient: string;
  url: string;
  /** The code a learner types on the partner's site. */
  code: string;
  /** Percent off, used for the badge. */
  discountPercent: number;
  /** Days between entering the code and having to pay, or it expires. */
  redeemWindowDays: number;
  taglineRu: string;
  taglineEn: string;
  bodyRu: string;
  bodyEn: string;
  /** Platforms the service runs on, as the partner names them. */
  platforms: string[];
  /** The conditions in full — every one that can void the discount. */
  termsRu: string[];
  termsEn: string[];
  /** Hidden from the page without deleting the record. */
  active: boolean;
}

export const partnerOffers: PartnerOffer[] = [
  {
    id: "syntx",
    name: "SYNTX AI",
    monogram: "SX",
    gradient: "linear-gradient(140deg, #6d4aff 0%, #b23bff 55%, #ff7a1a 100%)",
    url: "https://syntx.ai/welcome/V8sre2aW",
    code: "AIINSIDER15",
    discountPercent: 15,
    redeemWindowDays: 10,
    taglineRu: "Больше 100 AI-моделей в одном окне",
    taglineEn: "100+ AI models in one place",
    bodyRu:
      "Один доступ вместо подписки на каждый сервис отдельно — удобно, пока пробуете разные модели на учебных задачах. Работает в Telegram и в браузере.",
    bodyEn:
      "One subscription instead of paying for each service separately — handy while you are trying different models on coursework. Runs in Telegram and in the browser.",
    platforms: ["Telegram", "Web"],
    termsRu: [
      "Скидка действует только для новых пользователей сервиса",
      "Промокод срабатывает один раз на аккаунт",
      "После ввода кода есть 10 дней на оплату — потом он сгорает без возможности повтора",
    ],
    termsEn: [
      "The discount applies to new users of the service only",
      "The code works once per account",
      "After entering it you have 10 days to pay — then it expires for good",
    ],
    active: true,
  },
];

export function activeOffers(): PartnerOffer[] {
  return partnerOffers.filter((offer) => offer.active);
}

export function offerById(id: string): PartnerOffer | undefined {
  return partnerOffers.find((offer) => offer.id === id);
}
