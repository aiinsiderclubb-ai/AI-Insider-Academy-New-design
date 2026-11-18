import { NextResponse, type NextRequest } from "next/server";
import { getOAuthConfig } from "@/lib/api/public";
import { safeNext } from "@/lib/auth/redirects";
import { OAUTH_COOKIE, authorizeUrl, encodeAttempt, isOAuthProvider, randomToken } from "@/lib/auth/oauth";
import { attemptCookie, callbackUrl, loginWithError } from "@/lib/auth/oauth-routes";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

/**
 * GET /api/oauth/google?next=/ru/app&locale=ru — the sign-in button.
 *
 * Remembers the attempt in a short-lived cookie and sends the visitor to the
 * provider. Shadows the API proxy for this one path: the catch-all forwards
 * everything else under /api to Express.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const query = request.nextUrl.searchParams;
  const rawLocale = query.get("locale") ?? "";
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const next = safeNext(query.get("next"), locale);

  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(loginWithError(request, locale, "unavailable", next));
  }

  const config = await getOAuthConfig();
  const clientId = provider === "google" ? config.googleClientId : config.appleClientId;
  if (!config[provider] || !clientId) {
    return NextResponse.redirect(loginWithError(request, locale, "unavailable", next));
  }

  const state = randomToken();
  const nonce = randomToken();
  const response = NextResponse.redirect(
    authorizeUrl(provider, { clientId, redirectUri: callbackUrl(request, provider), state, nonce, locale }),
  );
  response.cookies.set(OAUTH_COOKIE, encodeAttempt({ provider, state, nonce, next, locale }), attemptCookie);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
