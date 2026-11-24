import { NextResponse, type NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import {
  OAUTH_COOKIE,
  appleFullName,
  decodeAttempt,
  isOAuthProvider,
  providerError,
  readJwtClaims,
  sameToken,
  type OAuthError,
} from "@/lib/auth/oauth";
import { attemptCookie, loginWithError } from "@/lib/auth/oauth-routes";
import { defaultLocale } from "@/lib/i18n/config";
import { SOURCE_COOKIE } from "@/lib/attribution";

type Ctx = { params: Promise<{ provider: string }> };

/**
 * POST /api/oauth/{provider}/callback — where Google and Apple send the
 * visitor back, with the ID token in the form body.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { provider } = await params;
  const form = await request.formData().catch(() => null);
  return finish(request, provider, (name) => form?.get(name) ?? null);
}

/** A provider that reports an error by query string instead of a form. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { provider } = await params;
  return finish(request, provider, (name) => request.nextUrl.searchParams.get(name));
}

async function finish(request: NextRequest, provider: string, field: (name: string) => FormDataEntryValue | null) {
  const attempt = decodeAttempt(request.cookies.get(OAUTH_COOKIE)?.value);
  const locale = attempt?.locale ?? defaultLocale;

  const fail = (reason: OAuthError) => done(NextResponse.redirect(loginWithError(request, locale, reason, attempt?.next), 303));

  // Only an answer to a sign-in this browser started counts. Without the
  // cookie, or with a different state, this is either a stale tab or someone
  // trying to sign the visitor into an account of their choosing.
  const state = String(field("state") ?? "");
  if (!attempt || !isOAuthProvider(provider) || attempt.provider !== provider || !sameToken(state, attempt.state)) {
    return fail("expired");
  }

  const error = field("error");
  if (error) return fail(providerError(String(error)));

  const idToken = String(field("id_token") ?? "");
  const claims = readJwtClaims(idToken);
  if (!claims || typeof claims.nonce !== "string" || !sameToken(claims.nonce, attempt.nonce)) {
    return fail("failed");
  }

  let result: { token: string; isNew?: boolean };
  try {
    result = await api<{ token: string; isNew?: boolean }>("/auth/oauth", {
      method: "POST",
      body: {
        provider,
        idToken,
        fullName: provider === "apple" ? appleFullName(field("user")) : null,
        // Only read for a new account: where the visitor first came from, and their language.
        source: request.cookies.get(SOURCE_COOKIE)?.value ?? null,
        locale,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      // An email account under the same address that was never confirmed:
      // linking it would let whoever registered it first into this one.
      if (err.status === 409) return fail("verify");
      if (err.status === 503) return fail("unavailable");
    }
    return fail("failed");
  }

  const target = result.isNew ? `/${locale}/onboarding` : attempt.next;
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions);
  return done(response);
}

/** Every answer, good or bad, ends the attempt. */
function done(response: NextResponse) {
  response.cookies.set(OAUTH_COOKIE, "", { ...attemptCookie, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
