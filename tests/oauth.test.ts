import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  OAUTH_COOKIE,
  appleFullName,
  authorizeUrl,
  decodeAttempt,
  encodeAttempt,
  providerError,
  readJwtClaims,
  sameToken,
  type OAuthAttempt,
} from "@/lib/auth/oauth";

/*
 * The sign-in routes are tested with the API mocked out: what matters here is
 * what the site itself decides — which answers it accepts, where it sends the
 * visitor, and which cookies it sets. The token's signature is the API's job
 * and is covered by its own tests.
 */

/*
 * A plain function rather than `vi.fn`: the spy chains its own `.then` onto a
 * returned promise to record how it settled, and when the API call is meant
 * to fail that extra chain is reported as an unhandled rejection.
 */
const apiMock = vi.hoisted(() => {
  const mock = {
    calls: [] as unknown[][],
    impl: async (..._args: unknown[]): Promise<unknown> => ({}),
    api: (...args: unknown[]) => {
      mock.calls.push(args);
      return mock.impl(...args);
    },
  };
  return mock;
});
const configMock = vi.hoisted(() => ({
  getOAuthConfig: vi.fn(async () => ({
    google: true,
    apple: false,
    googleClientId: "google-client.apps.googleusercontent.com",
    appleClientId: null,
  })),
}));

vi.mock("@/lib/api/http", async () => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { api: apiMock.api, ApiError };
});
vi.mock("@/lib/api/public", () => configMock);

const { GET: start } = await import("@/app/api/oauth/[provider]/route");
const { POST: callback } = await import("@/app/api/oauth/[provider]/callback/route");
const { ApiError } = await import("@/lib/api/http");

/** An unsigned JWT carrying the given claims — enough for the nonce check. */
function jwt(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

const ATTEMPT: OAuthAttempt = { provider: "google", state: "state-123", nonce: "nonce-456", next: "/en/learn", locale: "en" };

function answer(
  fields: Record<string, string>,
  attempt: OAuthAttempt | null = ATTEMPT,
  provider = "google",
  extraCookie = "",
) {
  const cookies = [attempt ? `${OAUTH_COOKIE}=${encodeAttempt(attempt)}` : "", extraCookie].filter(Boolean).join("; ");
  const request = new NextRequest(`https://myinsideracademy.com/api/oauth/${provider}/callback`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });
  return callback(request, { params: Promise.resolve({ provider }) });
}

describe("oauth helpers", () => {
  it("asks Google for a signed token, posted back, with state and nonce", () => {
    const url = new URL(
      authorizeUrl("google", { clientId: "cid", redirectUri: "https://x.test/cb", state: "s", nonce: "n", locale: "ukr" }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "cid",
      redirect_uri: "https://x.test/cb",
      response_type: "id_token",
      response_mode: "form_post",
      scope: "openid email profile",
      state: "s",
      nonce: "n",
      hl: "uk",
    });
  });

  it("asks Apple for name and email, which it only sends with a code", () => {
    const url = new URL(
      authorizeUrl("apple", { clientId: "com.x.web", redirectUri: "https://x.test/cb", state: "s", nonce: "n", locale: "ru" }),
    );
    expect(url.searchParams.get("response_type")).toBe("code id_token");
    expect(url.searchParams.get("scope")).toBe("name email");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
  });

  it("round-trips the attempt and rejects a tampered one", () => {
    expect(decodeAttempt(encodeAttempt(ATTEMPT))).toEqual(ATTEMPT);
    expect(decodeAttempt("not-base64-json")).toBeNull();
    expect(decodeAttempt(encodeAttempt({ ...ATTEMPT, provider: "facebook" as never }))).toBeNull();
    expect(decodeAttempt(undefined)).toBeNull();
  });

  it("reads claims without trusting malformed tokens", () => {
    expect(readJwtClaims(jwt({ nonce: "abc" }))).toEqual({ nonce: "abc" });
    expect(readJwtClaims("a.b")).toBeNull();
    expect(readJwtClaims("a.!!!.c")).toBeNull();
  });

  it("compares tokens exactly", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("", "")).toBe(false);
    expect(sameToken("abc", "abcd")).toBe(false);
  });

  it("takes Apple's one-time name, trimmed", () => {
    expect(appleFullName('{"name":{"firstName":" Olena ","lastName":"Koval"},"email":"x@y.z"}')).toEqual({
      firstName: "Olena",
      lastName: "Koval",
    });
    expect(appleFullName("not json")).toBeNull();
    expect(appleFullName(null)).toBeNull();
  });

  it("tells a cancelled sign-in from a broken one", () => {
    expect(providerError("access_denied")).toBe("cancelled");
    expect(providerError("user_cancelled_authorize")).toBe("cancelled");
    expect(providerError("invalid_request")).toBe("failed");
  });
});

describe("GET /api/oauth/[provider]", () => {
  it("sends the visitor to Google and remembers the attempt", async () => {
    const response = await start(
      new NextRequest("https://myinsideracademy.com/api/oauth/google?locale=en&next=/en/learn"),
      { params: Promise.resolve({ provider: "google" }) },
    );
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get("location")!);
    expect(target.host).toBe("accounts.google.com");
    // Outside production the callback is the request's own origin.
    expect(target.searchParams.get("redirect_uri")).toBe("https://myinsideracademy.com/api/oauth/google/callback");

    const cookie = response.cookies.get(OAUTH_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("none");
    const attempt = decodeAttempt(cookie.value)!;
    expect(attempt).toMatchObject({ provider: "google", next: "/en/learn", locale: "en" });
    expect(target.searchParams.get("state")).toBe(attempt.state);
    expect(target.searchParams.get("nonce")).toBe(attempt.nonce);
  });

  it("will not carry an off-site `next` through the round trip", async () => {
    const response = await start(
      new NextRequest("https://myinsideracademy.com/api/oauth/google?locale=ru&next=//evil.test/x"),
      { params: Promise.resolve({ provider: "google" }) },
    );
    expect(decodeAttempt(response.cookies.get(OAUTH_COOKIE)!.value)!.next).toBe("/ru/app");
  });

  it("sends a provider that is not configured back to the login page", async () => {
    const response = await start(new NextRequest("https://myinsideracademy.com/api/oauth/apple?locale=ru"), {
      params: Promise.resolve({ provider: "apple" }),
    });
    expect(response.headers.get("location")).toBe("https://myinsideracademy.com/ru/login?oauth=unavailable");
    expect(response.cookies.get(OAUTH_COOKIE)).toBeUndefined();
  });
});

describe("POST /api/oauth/[provider]/callback", () => {
  beforeEach(() => {
    apiMock.calls = [];
    apiMock.impl = async () => ({});
  });

  it("signs the visitor in and sends them where they were going", async () => {
    apiMock.impl = async () => ({ token: "session-jwt", isNew: false });
    const idToken = jwt({ nonce: "nonce-456" });
    const response = await answer({ state: "state-123", id_token: idToken });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://myinsideracademy.com/en/learn");
    expect(response.cookies.get("aia_session")?.value).toBe("session-jwt");
    expect(response.cookies.get(OAUTH_COOKIE)?.value).toBe("");
    expect(apiMock.calls).toEqual([
      ["/auth/oauth", { method: "POST", body: { provider: "google", idToken, fullName: null, source: null, locale: "en" } }],
    ]);
  });

  it("passes on where a new visitor first came from", async () => {
    apiMock.impl = async () => ({ token: "session-jwt", isNew: true });
    const idToken = jwt({ nonce: "nonce-456" });
    await answer({ state: "state-123", id_token: idToken }, ATTEMPT, "google", "aia-src=l.instagram.com");
    expect(apiMock.calls[0][1]).toMatchObject({ body: { source: "l.instagram.com" } });
  });

  it("sends a brand-new account to onboarding", async () => {
    apiMock.impl = async () => ({ token: "session-jwt", isNew: true });
    const response = await answer({ state: "state-123", id_token: jwt({ nonce: "nonce-456" }) });
    expect(response.headers.get("location")).toBe("https://myinsideracademy.com/en/onboarding");
  });

  it("refuses an answer to a sign-in this browser did not start", async () => {
    for (const response of [
      await answer({ state: "someone-elses-state", id_token: jwt({ nonce: "nonce-456" }) }),
      await answer({ state: "state-123", id_token: jwt({ nonce: "nonce-456" }) }, null),
      await answer({ state: "state-123", id_token: jwt({ nonce: "nonce-456" }) }, ATTEMPT, "apple"),
    ]) {
      expect(new URL(response.headers.get("location")!).searchParams.get("oauth")).toBe("expired");
      expect(response.cookies.get("aia_session")).toBeUndefined();
    }
    expect(apiMock.calls).toEqual([]);
  });

  it("refuses a token minted for another sign-in", async () => {
    const response = await answer({ state: "state-123", id_token: jwt({ nonce: "replayed" }) });
    expect(new URL(response.headers.get("location")!).searchParams.get("oauth")).toBe("failed");
    expect(apiMock.calls).toEqual([]);
  });

  it("explains a cancelled sign-in and keeps where the visitor was going", async () => {
    const response = await answer({ state: "state-123", error: "access_denied" });
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/en/login");
    expect(location.searchParams.get("oauth")).toBe("cancelled");
    expect(location.searchParams.get("next")).toBe("/en/learn");
  });

  it("asks for the email account to be confirmed first when the API says so", async () => {
    apiMock.impl = async () => {
      throw new ApiError(409, "conflict", "Verify first");
    };
    const response = await answer({ state: "state-123", id_token: jwt({ nonce: "nonce-456" }) });
    expect(new URL(response.headers.get("location")!).searchParams.get("oauth")).toBe("verify");
    expect(response.cookies.get("aia_session")).toBeUndefined();
  });

  it("passes Apple's one-time name to the API", async () => {
    apiMock.impl = async () => ({ token: "t" });
    await answer(
      {
        state: "state-123",
        id_token: jwt({ nonce: "nonce-456" }),
        user: JSON.stringify({ name: { firstName: "Ann", lastName: "Lee" } }),
      },
      { ...ATTEMPT, provider: "apple" },
      "apple",
    );
    expect((apiMock.calls[0][1] as { body: { fullName: unknown } }).body.fullName).toEqual({ firstName: "Ann", lastName: "Lee" });
  });
});
