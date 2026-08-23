export const locales = ["ru", "ukr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

/** Full names, shown in the language menu in the language itself. */
export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  ukr: "Українська",
  en: "English",
};

/** Two-letter marks used in compact switchers. */
export const localeShort: Record<Locale, string> = {
  ru: "RU",
  ukr: "UA",
  en: "EN",
};

/** `ukr` is kept as the URL segment so existing indexed pages survive. */
export const htmlLang: Record<Locale, string> = {
  ru: "ru",
  ukr: "uk",
  en: "en",
};

export const bcp47: Record<Locale, string> = {
  ru: "ru-RU",
  ukr: "uk-UA",
  en: "en-GB",
};

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Best-effort match of an Accept-Language header to a supported locale. */
export function matchLocale(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of wanted) {
    if (tag.startsWith("uk")) return "ukr";
    if (tag.startsWith("ru")) return "ru";
    if (tag.startsWith("en")) return "en";
  }
  return defaultLocale;
}

/** Builds a locale-prefixed href: `path("/learn", "en") -> "/en/learn"`. */
export function path(href: string, locale: Locale): string {
  const clean = href.startsWith("/") ? href : `/${href}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
