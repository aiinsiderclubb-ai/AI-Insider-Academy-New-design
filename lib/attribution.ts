/**
 * Where a visitor first came from, kept so a sign-up days later can still be
 * credited to the TikTok video or Telegram post that brought them.
 *
 * The cookie holds one short label — a link's `utm_source`, or the host of the
 * outside site that referred the first visit — and nothing about the person.
 * The first source wins for 90 days. The API turns the label into its report
 * name (m.facebook.com → facebook), so this side only cleans it.
 */
export const SOURCE_COOKIE = "aia-src";
export const SOURCE_MAX_AGE = 60 * 60 * 24 * 90;

const LABEL = /[^a-z0-9._-]/g;

function clean(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(LABEL, "")
    .slice(0, 60);
}

/** The label for a first visit, or "" when it came from nowhere in particular. */
export function firstTouchSource(utmSource: string | null, referer: string | null, ownHost: string): string {
  const fromUtm = clean(utmSource);
  if (fromUtm) return fromUtm;
  if (!referer) return "";
  try {
    const host = new URL(referer).hostname.replace(/^www\./, "");
    const own = ownHost.split(":")[0].replace(/^www\./, "");
    if (!host || host === own || host.endsWith(`.${own}`)) return "";
    return clean(host);
  } catch {
    return "";
  }
}
