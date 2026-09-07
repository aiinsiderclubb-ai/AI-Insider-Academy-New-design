import { describe, expect, it } from "vitest";
import { giveawayIsOpen } from "@/content/community";

describe("giveawayIsOpen", () => {
  it("treats a past deadline as closed even if the record still says active", () => {
    expect(giveawayIsOpen("active", "2026-08-31T23:59:59+03:00", Date.parse("2026-09-07T12:00:00+02:00"))).toBe(
      false,
    );
  });

  it("stays open before the 25 September deadline", () => {
    expect(giveawayIsOpen("active", "2026-09-25T23:59:59+03:00", Date.parse("2026-09-07T12:00:00+02:00"))).toBe(
      true,
    );
  });

  it("stays closed once marked finished", () => {
    expect(giveawayIsOpen("finished", "2026-12-31T23:59:59+03:00", Date.parse("2026-09-07T12:00:00+02:00"))).toBe(
      false,
    );
  });
});
