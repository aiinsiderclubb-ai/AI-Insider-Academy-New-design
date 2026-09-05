import { describe, expect, it } from "vitest";
import { defaultLocale, htmlLang, isLocale, locales, matchLocale, path } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n";

describe("matchLocale", () => {
  it("picks the highest-quality supported tag", () => {
    expect(matchLocale("de-DE,de;q=0.9,en;q=0.8")).toBe("en");
    expect(matchLocale("en-GB;q=0.5,uk-UA;q=0.9")).toBe("ukr");
    expect(matchLocale("ru-RU,ru;q=0.9,en-US;q=0.8")).toBe("ru");
  });

  it("maps Ukrainian's real tag to the `ukr` URL segment", () => {
    // The segment stays `ukr` so indexed pages survive; the header says `uk`.
    expect(matchLocale("uk")).toBe("ukr");
    expect(matchLocale("uk-UA")).toBe("ukr");
    expect(htmlLang.ukr).toBe("uk");
  });

  it("falls back to the default for an empty or unsupported header", () => {
    expect(matchLocale(null)).toBe(defaultLocale);
    expect(matchLocale(undefined)).toBe(defaultLocale);
    expect(matchLocale("")).toBe(defaultLocale);
    expect(matchLocale("ja,ko;q=0.9")).toBe(defaultLocale);
  });

  it("survives a malformed q value instead of throwing", () => {
    expect(locales).toContain(matchLocale("en;q=nonsense,ru"));
  });
});

describe("isLocale", () => {
  it("accepts exactly the supported set", () => {
    for (const locale of locales) expect(isLocale(locale)).toBe(true);
  });

  it("rejects near-misses", () => {
    // `/ua` and `/uk` are redirected by the proxy, they are not locales.
    expect(isLocale("ua")).toBe(false);
    expect(isLocale("uk")).toBe(false);
    expect(isLocale("RU")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});

describe("path", () => {
  it("prefixes a route with its locale", () => {
    expect(path("/learn", "en")).toBe("/en/learn");
    expect(path("learn", "en")).toBe("/en/learn");
    expect(path("/learn?tab=bundles", "ru")).toBe("/ru/learn?tab=bundles");
  });

  it("collapses the root to the bare locale, with no trailing slash", () => {
    expect(path("/", "ru")).toBe("/ru");
    expect(path("/", "ukr")).toBe("/ukr");
  });
});

describe("plural", () => {
  const forms: [string, string, string] = ["урок", "урока", "уроков"];

  it("follows the Russian rule, including the teens exception", () => {
    expect(plural(1, "ru", forms)).toBe("урок");
    expect(plural(2, "ru", forms)).toBe("урока");
    expect(plural(5, "ru", forms)).toBe("уроков");
    expect(plural(11, "ru", forms)).toBe("уроков");
    expect(plural(12, "ru", forms)).toBe("уроков");
    expect(plural(21, "ru", forms)).toBe("урок");
    expect(plural(22, "ru", forms)).toBe("урока");
    expect(plural(111, "ru", forms)).toBe("уроков");
    expect(plural(0, "ru", forms)).toBe("уроков");
  });

  it("is singular-or-plural in English", () => {
    expect(plural(1, "en", ["lesson", "lessons", "lessons"])).toBe("lesson");
    expect(plural(0, "en", ["lesson", "lessons", "lessons"])).toBe("lessons");
    expect(plural(21, "en", ["lesson", "lessons", "lessons"])).toBe("lessons");
  });
});
