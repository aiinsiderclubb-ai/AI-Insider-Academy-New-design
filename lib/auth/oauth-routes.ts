import "server-only";
import type { NextRequest } from "next/server";
import { resolveSiteUrl } from "@/lib/api/origin";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { OAUTH_COOKIE_MAX_AGE, type OAuthError, type OAuthProvider } from "./oauth";

/**
 * The address the provider sends the visitor back to. It has to match, to the
 * character, one registered with Google and Apple — so production always uses
 * the canonical site address, never whichever alias the request came in on.
 * Local development answers on its own origin.
 */
export function callbackUrl(request: NextRequest, provider: OAuthProvider): string {
  const origin = process.env.NODE_ENV === "production" ? resolveSiteUrl() : request.nextUrl.origin;
  return `${origin}/api/oauth/${provider}/callback`;
}

/**
 * The attempt cookie comes back on a cross-site POST from the provider, which
 * `SameSite=Lax` would withhold — so `None`, and therefore `Secure` (browsers
 * accept that on http://localhost too). Scoped to the OAuth routes, which are
 * the only ones that read it.
 */
export const attemptCookie = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/api/oauth",
  maxAge: OAUTH_COOKIE_MAX_AGE,
};

/** Back to the sign-in page with a reason it can show. */
export function loginWithError(request: NextRequest, locale: string, error: OAuthError, next?: string): URL {
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const url = new URL(`/${safeLocale}/login`, request.url);
  url.searchParams.set("oauth", error);
  if (next && next !== `/${safeLocale}/app`) url.searchParams.set("next", next);
  return url;
}
