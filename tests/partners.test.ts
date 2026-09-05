import { describe, expect, it } from "vitest";
import { activeOffers, offerById, partnerOffers, type PartnerOffer } from "@/content/partners";

/**
 * These records carry a promo code and an affiliate link. A typo in either is
 * invisible on screen — the card renders perfectly and the discount simply
 * never applies, or the referral never attributes.
 */
describe("partner offers", () => {
  it("has unique ids", () => {
    const ids = partnerOffers.map((offer) => offer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(partnerOffers.map((offer): [string, PartnerOffer] => [offer.id, offer]))(
    "%s is complete",
    (_id, offer) => {
      expect(offer.name.trim()).not.toBe("");
      expect(offer.monogram).toMatch(/^\S{1,3}$/);

      // Codes are typed by hand off a phone: no spaces, no lowercase drift.
      expect(offer.code).toMatch(/^[A-Z0-9]+$/);

      expect(offer.discountPercent).toBeGreaterThan(0);
      expect(offer.discountPercent).toBeLessThanOrEqual(100);
      expect(offer.redeemWindowDays).toBeGreaterThan(0);

      expect(offer.platforms.length).toBeGreaterThan(0);
      for (const copy of [offer.taglineRu, offer.taglineEn, offer.bodyRu, offer.bodyEn]) {
        expect(copy.trim()).not.toBe("");
      }
    },
  );

  it.each(partnerOffers.map((offer): [string, PartnerOffer] => [offer.id, offer]))(
    "%s links over https to the partner, not to us",
    (_id, offer) => {
      const url = new URL(offer.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).not.toMatch(/myinsideracademy\.com$/);
    },
  );

  it.each(partnerOffers.map((offer): [string, PartnerOffer] => [offer.id, offer]))(
    "%s states its conditions in both languages",
    (_id, offer) => {
      // An unstated rule that voids the discount is the same as no discount.
      expect(offer.termsRu.length).toBeGreaterThan(0);
      expect(offer.termsRu.length).toBe(offer.termsEn.length);
      for (const term of [...offer.termsRu, ...offer.termsEn]) {
        expect(term.trim()).not.toBe("");
      }
    },
  );

  it("mentions the redemption window in the conditions it shows", () => {
    // The card prints the window separately; a mismatch between the two is
    // the kind of thing nobody notices until someone loses the discount.
    for (const offer of partnerOffers) {
      const stated = `${offer.redeemWindowDays}`;
      expect(offer.termsRu.join(" ")).toContain(stated);
      expect(offer.termsEn.join(" ")).toContain(stated);
    }
  });

  it("hides inactive offers and finds one by id", () => {
    expect(activeOffers().every((offer) => offer.active)).toBe(true);
    expect(offerById("syntx")?.code).toBe("AIINSIDER15");
    expect(offerById("nope")).toBeUndefined();
  });
});
