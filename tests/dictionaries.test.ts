import { describe, expect, it } from "vitest";
import { ru } from "@/lib/i18n/dictionaries/ru";
import { ukr } from "@/lib/i18n/dictionaries/ukr";
import { en } from "@/lib/i18n/dictionaries/en";
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";

type Flat = Record<string, string>;

/** `home.ctaBody` — the shape a missing key is reported in. */
function flatten(dictionary: object): Flat {
  const out: Flat = {};
  for (const [section, entries] of Object.entries(dictionary)) {
    for (const [key, value] of Object.entries(entries as object)) {
      out[`${section}.${key}`] = value as string;
    }
  }
  return out;
}

const source = flatten(ru);

describe.each([
  ["ukr", ukr],
  ["en", en],
])("%s dictionary", (name, dictionary) => {
  const translated = flatten(dictionary);

  it("carries every key `ru` defines", () => {
    const missing = Object.keys(source).filter((key) => !(key in translated));
    expect(missing, `missing in ${name}`).toEqual([]);
  });

  it("defines no key `ru` does not", () => {
    const extra = Object.keys(translated).filter((key) => !(key in source));
    expect(extra, `unknown in ${name}`).toEqual([]);
  });

  it("leaves nothing blank", () => {
    const blank = Object.entries(translated)
      .filter(([, value]) => typeof value !== "string" || value.trim() === "")
      .map(([key]) => key);
    expect(blank, `blank in ${name}`).toEqual([]);
  });
});

describe("getDictionary", () => {
  it("answers for every supported locale", () => {
    for (const locale of locales) {
      expect(getDictionary(locale).brand.name).toBeTruthy();
    }
  });

  it("falls back to Russian for anything else", () => {
    expect(getDictionary("de")).toBe(ru);
    expect(getDictionary(undefined)).toBe(ru);
  });
});

describe("the closing CTA", () => {
  // The marker is applied by splitting `ctaBody` on `ctaMark`. A translation
  // that reworded one without the other renders the sentence unmarked, which
  // is silent — nothing throws and the page still builds.
  it.each([
    ["ru", ru],
    ["ukr", ukr],
    ["en", en],
  ])("%s highlights a phrase that occurs in its own sentence", (name, dictionary) => {
    const { ctaBody, ctaMark } = dictionary.home;
    expect(ctaMark.trim(), `${name} has no mark`).not.toBe("");
    expect(ctaBody, `${name} mark is not in the sentence`).toContain(ctaMark);
  });
});
