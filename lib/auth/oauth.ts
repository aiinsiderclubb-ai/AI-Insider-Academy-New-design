/*
 * Signing in with Google and Apple.
 *
 * Both run as a redirect, not a pop-up or an embedded SDK: the button is an
 * ordinary link styled like the rest of the site, and no third-party script is
 * loaded on the sign-in pages. The provider sends the visitor back with a
 * signed ID token by POST (`response_mode=form_post`), which keeps the token
 * out of the address bar, browser history and Referer headers.
 *
 * Asking for the ID token directly, rather than a code to exchange, means the
 * site holds no client secret at all — for Apple that would be a private key
 * and a JWT re-signed every six months. The token's signature, issuer and
 * audience are checked by the API (server/services/oauthVerify.js); what is
 * checked here is that the answer belongs to a sign-in this browser started:
 *
 *  - `state` ties the callback to the cookie set when the visitor clicked,
 *    so nobody can sign a visitor into the attacker's account by sending
 *    them a forged callback;
 *  - `nonce` is copied by the provider into the signed token, so a token
 *    captured from one sign-in cannot be replayed into another.
 *
 * Client ids come from the API (/auth/oauth/config) so the API and the site
 * cannot disagree about which app a token must be issued to.
 */

export const OAUTH_PROVIDERS = ["google", "apple"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export const OAUTH_COOKIE = "aia_oauth";
/** Long enough to pick an account and pass two-factor; short enough to be useless later. */
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

/** What the sign-in page needs to know: which buttons can work. */
export interface OAuthConfig {
  google: boolean;
  apple: boolean;
  googleClientId: string | null;
  appleClientId: string | null;
}

/** Remembered between the click and the provider's answer. */
export interface OAuthAttempt {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  next: string;
  locale: string;
}

const AUTHORIZE: Record<OAuthProvider, string> = {
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  apple: "https://appleid.apple.com/auth/authorize",
};

export function authorizeUrl(
  provider: OAuthProvider,
  { clientId, redirectUri, state, nonce, locale }: { clientId: string; redirectUri: string; state: string; nonce: string; locale: string },
): string {
  const url = new URL(AUTHORIZE[provider]);
  const params = url.searchParams;
  params.set("client_id", clientId);
  params.set("redirect_uri", redirectUri);
  params.set("state", state);
  params.set("nonce", nonce);
  params.set("response_mode", "form_post");
  if (provider === "google") {
    params.set("response_type", "id_token");
    params.set("scope", "openid email profile");
    params.set("prompt", "select_account");
    params.set("hl", locale === "ukr" ? "uk" : locale);
  } else {
    // Apple only reports the name on the very first sign-in, and only with
    // both a code and the `name` scope requested.
    params.set("response_type", "code id_token");
    params.set("scope", "name email");
  }
  return url.toString();
}

/** URL-safe random token. */
export function randomToken(bytes = 24): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Buffer.from(data).toString("base64url");
}

/**
 * The claims of a JWT, without checking the signature — only to read the
 * nonce before handing the token to the API, which does check it.
 */
export function readJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Constant-time comparison of two short strings. */
export function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function encodeAttempt(attempt: OAuthAttempt): string {
  return Buffer.from(JSON.stringify(attempt), "utf8").toString("base64url");
}

export function decodeAttempt(value: string | undefined): OAuthAttempt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OAuthAttempt>;
    if (
      !isOAuthProvider(parsed.provider) ||
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.next !== "string" ||
      typeof parsed.locale !== "string"
    ) {
      return null;
    }
    return parsed as OAuthAttempt;
  } catch {
    return null;
  }
}

/**
 * The name Apple sends once, on the first sign-in, as a JSON form field:
 * `{"name":{"firstName":"…","lastName":"…"},"email":"…"}`.
 */
export function appleFullName(raw: FormDataEntryValue | null): { firstName?: string; lastName?: string } | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const name = (JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } }).name;
    if (!name) return null;
    const clean = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 60) : undefined);
    return { firstName: clean(name.firstName), lastName: clean(name.lastName) };
  } catch {
    return null;
  }
}

/** Why a sign-in failed, as shown on the login page (`?oauth=…`). */
export type OAuthError = "cancelled" | "expired" | "unavailable" | "verify" | "failed";

export function isOAuthError(value: unknown): value is OAuthError {
  return value === "cancelled" || value === "expired" || value === "unavailable" || value === "verify" || value === "failed";
}

/** The provider's own error codes, sorted into what the visitor can act on. */
export function providerError(code: string): OAuthError {
  return code === "access_denied" || code === "user_cancelled_authorize" ? "cancelled" : "failed";
}
