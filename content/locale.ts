import type { Locale } from "@/lib/i18n/config";

/**
 * Migrated content carries Russian and English variants only. Ukrainian reads
 * the Russian field until translations land, which is exactly what the old
 * platform did — the difference is that it happens in one place, so Studio can
 * report on it instead of it silently leaking into a page.
 */
export function pick<T>(locale: Locale, ru: T, en: T): T {
  return locale === "en" ? en : ru;
}

/** Picks `field` or `fieldEn` off an object by the current locale. */
export function field<T extends Record<string, unknown>, K extends string & keyof T>(
  source: T,
  key: K,
  locale: Locale,
): T[K] {
  const enKey = `${key}En` as keyof T;
  if (locale === "en" && source[enKey] != null && source[enKey] !== "") return source[enKey] as T[K];
  return source[key];
}

/** Picks `fieldRu` / `fieldEn` pairs, which the marketplace data uses. */
export function suffixed<T extends Record<string, unknown>>(
  source: T,
  base: string,
  locale: Locale,
): string {
  const key = locale === "en" ? `${base}En` : `${base}Ru`;
  const value = source[key] ?? source[`${base}Ru`] ?? source[base];
  return typeof value === "string" ? value : "";
}

export function suffixedList<T extends Record<string, unknown>>(
  source: T,
  base: string,
  locale: Locale,
): string[] {
  const key = locale === "en" ? `${base}En` : `${base}Ru`;
  const value = source[key] ?? source[`${base}Ru`] ?? source[base];
  return Array.isArray(value) ? (value as string[]) : [];
}
