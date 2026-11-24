import { describe, expect, it } from "vitest";
import { firstTouchSource } from "@/lib/attribution";

describe("firstTouchSource", () => {
  it("prefers the link's utm_source, cleaned", () => {
    expect(firstTouchSource("TikTok Bio!", "https://t.me/x", "myinsideracademy.com")).toBe("tiktokbio");
  });

  it("falls back to an outside referrer's host", () => {
    expect(firstTouchSource(null, "https://www.youtube.com/watch?v=1", "myinsideracademy.com")).toBe("youtube.com");
  });

  it("ignores the site itself and empty referrers", () => {
    expect(firstTouchSource(null, "https://myinsideracademy.com/ru/learn", "myinsideracademy.com")).toBe("");
    expect(firstTouchSource(null, "https://www.myinsideracademy.com/", "myinsideracademy.com")).toBe("");
    expect(firstTouchSource("", null, "myinsideracademy.com")).toBe("");
    expect(firstTouchSource(null, "not a url", "myinsideracademy.com")).toBe("");
  });
});
