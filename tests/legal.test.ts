import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legalDocument, legalSlugs } from "@/content/legal";
import { legalEntity, legalIsDraft, links } from "@/content/site";

const legalJson = readFileSync(new URL("../content/data/legal.json", import.meta.url), "utf8");

describe("legal copy before live sales", () => {
  it("keeps the seller in draft until real registration data exists", () => {
    expect(legalIsDraft).toBe(true);
    expect(legalEntity.draft).toBe(true);
  });

  it("routes claims and privacy to the Academy mailbox, not the old hello@ alias", () => {
    expect(legalEntity.emailClaims).toBe("info@myinsideracademy.com");
    expect(legalEntity.emailPrivacy).toBe("info@myinsideracademy.com");
    expect(links.contactEmail).toBe("info@myinsideracademy.com");
  });

  it("publishes offer, privacy, refund and Impressum without TODO dumps or unused processors", () => {
    expect(legalSlugs).toEqual(expect.arrayContaining(["offer", "privacy", "refund", "impressum", "giveaway-rules"]));
    expect(legalJson).not.toMatch(/hello@aiinsider\.com/);
    expect(legalJson).not.toMatch(/TODO:/);
    expect(legalJson).not.toMatch(/Stripe/);
    expect(legalJson).not.toMatch(/LiqPay/);

    const offer = legalDocument("offer");
    expect(offer?.sections.some((section) => section.id === "withdrawal")).toBe(true);
    expect(offer?.sections.flatMap((section) => section.paragraphs).join(" ")).toMatch(/Tribute/);

    const privacy = legalDocument("privacy");
    expect(privacy?.sections.flatMap((section) => section.paragraphs).join(" ")).toMatch(/Tribute/);
    expect(privacy?.sections.flatMap((section) => section.paragraphs).join(" ")).not.toMatch(/Stripe/);
  });
});
