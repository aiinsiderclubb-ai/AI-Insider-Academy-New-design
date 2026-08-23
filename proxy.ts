import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales, matchLocale } from "@/lib/i18n/config";

const LOCALE_COOKIE = "aia-locale";

/** Old routes that people already have bookmarked or indexed. */
const legacyRedirects: Record<string, string> = {
  "/courses": "/learn",
  "/learning-map": "/learn/path",
  "/marketplace": "/store",
  "/memberships": "/plans",
  "/events": "/community/events",
  "/forum": "/community/forum",
  "/blog": "/community/blog",
  "/cabinet": "/app",
  "/account": "/app/settings",
  "/calendar": "/community/events",
  "/oferta": "/legal/offer",
  "/privacy": "/legal/privacy",
  "/refund": "/legal/refund",
  "/giveaway-rules": "/legal/giveaway-rules",
  "/admin": "/studio",
};

function resolveLocale(request: NextRequest) {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return matchLocale(request.headers.get("accept-language"));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  // Already localised — let it through.
  if (isLocale(first)) {
    const rest = `/${segments.slice(1).join("/")}`;
    const legacy = legacyRedirects[rest];
    if (legacy) {
      return NextResponse.redirect(new URL(`/${first}${legacy}${search}`, request.url), 308);
    }
    return NextResponse.next();
  }

  const locale = resolveLocale(request);

  // `/ua` was never a route, but people type it.
  if (first === "ua" || first === "uk") {
    const rest = `/${segments.slice(1).join("/")}`;
    return NextResponse.redirect(new URL(`/ukr${rest === "/" ? "" : rest}${search}`, request.url), 308);
  }

  const legacy = legacyRedirects[pathname];
  const target = legacy ?? (pathname === "/" ? "" : pathname);

  const response = NextResponse.redirect(new URL(`/${locale}${target}${search}`, request.url), legacy ? 308 : 307);
  if (!isLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}

export const config = {
  matcher: [
    // everything except API proxy, Next internals, and files with an extension
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)",
  ],
};

export { defaultLocale, locales };
