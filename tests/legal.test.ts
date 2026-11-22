import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legalDocument, legalSlugs } from "@/content/legal";
import { legalEntity, legalIsDraft, links } from "@/content/site";

const legalJson = readFileSync(new URL("../content/data/legal.json", import.meta.url), "utf8");

describe("legal copy before live sales", () => {
  it("names a real seller and leaves no placeholder behind", () => {
    expect(legalIsDraft).toBe(false);
    expect(legalEntity.draft).toBe(false);
    expect(legalEntity.legalNameEn.trim().length).toBeGreaterThan(3);
    expect(Object.values(legalEntity).filter((value) => typeof value === "string" && value.startsWith("TODO:"))).toEqual([]);
    // Gumroad pays out; bank details are not published.
    expect(legalEntity.iban).toBe("");
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

    expect(legalJson).not.toMatch(/Tribute/);

    // Gumroad sells every order as Merchant of Record.
    for (const locale of ["ru", "en"] as const) {
      const offer = legalDocument("offer", locale);
      const text = (doc: ReturnType<typeof legalDocument>) => doc?.sections.flatMap((section) => [...section.paragraphs, ...(section.items ?? [])]).join(" ") ?? "";
      expect(text(offer)).toMatch(/Gumroad/);
      expect(text(offer)).toMatch(/Merchant of Record/);
      expect(text(legalDocument("refund", locale))).toMatch(/14/);
      expect(text(legalDocument("privacy", locale))).toMatch(/Gumroad/);
    }
    expect(legalDocument("offer", "en")?.title).toBe("Terms of Service");
    expect(legalDocument("terms", "en")?.slug).toBe("offer");
    expect(legalDocument("offer", "ukr")?.title).toBe(legalDocument("offer", "ru")?.title);
  });
});
