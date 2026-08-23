import { bcp47, defaultLocale, isLocale, type Locale } from "./config";
import { ru, type Dictionary } from "./dictionaries/ru";
import { ukr } from "./dictionaries/ukr";
import { en } from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { ru, ukr, en };

export function getDictionary(locale: string | undefined): Dictionary {
  return dictionaries[isLocale(locale) ? locale : defaultLocale];
}

export type { Dictionary };
export * from "./config";

/* --------------------------------------------------------------------------
   Formatting — one place, so prices and dates never drift between screens.
   -------------------------------------------------------------------------- */

export function formatPrice(
  amount: number,
  locale: Locale,
  { currency = "EUR", decimals = false }: { currency?: string; decimals?: boolean } = {},
): string {
  return new Intl.NumberFormat(bcp47[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(amount);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(bcp47[locale]).format(value);
}

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(bcp47[locale], options).format(date);
}

export function formatRelative(value: string | number | Date, locale: Locale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(bcp47[locale], { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), "second");
}

/**
 * Slavic plural selection. `forms` is [one, few, many]; English ignores the
 * third form. Used for "3 урока" / "5 уроков" / "3 lessons".
 */
export function plural(count: number, locale: Locale, forms: [string, string, string]): string {
  if (locale === "en") return Math.abs(count) === 1 ? forms[0] : forms[1];
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

export function lessonCount(count: number, locale: Locale, d: Dictionary): string {
  return `${count} ${plural(count, locale, [d.common.lessons_1, d.common.lessons_2, d.common.lessons_5])}`;
}

export function resultCount(count: number, locale: Locale, d: Dictionary): string {
  return `${count} ${plural(count, locale, [d.common.results_1, d.common.results_2, d.common.results_5])}`;
}
