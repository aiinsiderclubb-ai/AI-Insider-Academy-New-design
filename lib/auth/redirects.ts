import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Where a form is allowed to send someone after it succeeds.
 *
 * `next` arrives from the query string, so it is attacker-controlled: a link
 * to `/ru/login?next=https://…` would hand a freshly signed-in visitor to
 * another origin, carrying whatever trust the sign-in just established. Only a
 * same-site path is allowed through.
 *
 * Rejected, in order of how easily each is missed:
 *
 *  - anything that is not rooted at `/` — `https://evil.test`, `evil.test`;
 *  - `//evil.test` and `/\evil.test`, which are protocol-relative URLs: the
 *    browser reads them as a host, not a path;
 *  - a path carrying its own scheme or credentials past a newline, which some
 *    header-splitting payloads use.
 *
 * Lives outside `actions.ts` because that file is `"use server"`, where every
 * export has to be an async server action.
 */
export function safeNext(value: unknown, locale: Locale = defaultLocale): string {
  const fallback = `/${isLocale(locale) ? locale : defaultLocale}/app`;
  if (typeof value !== "string") return fallback;

  const raw = value.trim();
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Matching control characters is the whole point here: a newline in this
  // value is someone trying to smuggle a second header past the redirect.
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  return raw;
}
