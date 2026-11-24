import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales, matchLocale } from "@/lib/i18n/config";
import { coursesPublic, isCourseOnlyPath } from "@/lib/visibility";
import { SOURCE_COOKIE, SOURCE_MAX_AGE, firstTouchSource } from "@/lib/attribution";

const LOCALE_COOKIE = "aia-locale";
/** A friend's referral code from `?ref=`, kept for checkout — see components/checkout. */
export const REF_COOKIE = "aia-ref";
const REF_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

/**
 * Remembers who sent the visitor. The first link wins for 30 days, so a later
 * link from someone else does not take over a referral already made.
 */
function rememberReferral(request: NextRequest, response: NextResponse) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref || !REF_PATTERN.test(ref) || request.cookies.get(REF_COOKIE)?.value) return response;
  response.cookies.set(REF_COOKIE, ref.toUpperCase(), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return response;
}

/** Old routes that people already have bookmarked or indexed. */
const legacyRedirects: Record<string, string> = {
  "/courses": "/learn",
  "/learning-map": "/learn",
  "/learn/path": "/learn",
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
  "/impressum": "/legal/impressum",
  "/giveaway-rules": "/legal/giveaway-rules",
  "/admin": "/studio",
};

function resolveLocale(request: NextRequest) {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return matchLocale(request.headers.get("accept-language"));
}

/** The first outside source of a visit, for crediting a later sign-up — see lib/attribution. */
function rememberSource(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(SOURCE_COOKIE)?.value) return response;
  const source = firstTouchSource(
    request.nextUrl.searchParams.get("utm_source"),
    request.headers.get("referer"),
    request.nextUrl.host,
  );
  if (source) response.cookies.set(SOURCE_COOKIE, source, { path: "/", maxAge: SOURCE_MAX_AGE, sameSite: "lax" });
  return response;
}

export function proxy(request: NextRequest) {
  return rememberSource(request, rememberReferral(request, route(request)));
}

function route(request: NextRequest) {
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
    // Courses are hidden until launch: every course, lesson and plan address
    // shows the "opening soon" page instead — under its own URL, so old links
    // and bookmarks come back to life by themselves once the flag is set.
    if (!coursesPublic() && isCourseOnlyPath(rest)) {
      const response = NextResponse.rewrite(new URL(`/${first}/soon`, request.url));
      response.headers.set("X-Robots-Tag", "noindex");
      return response;
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
