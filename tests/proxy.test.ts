import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const SITE = "https://academy.test";

function request(url: string, init?: { locale?: string; acceptLanguage?: string }) {
  const req = new NextRequest(new URL(url, SITE), {
    headers: init?.acceptLanguage ? { "accept-language": init.acceptLanguage } : undefined,
  });
  if (init?.locale) req.cookies.set("aia-locale", init.locale);
  return req;
}

/** `null` when the middleware let the request through untouched. */
function redirect(response: Response): { to: string; status: number } | null {
  const location = response.headers.get("location");
  return location ? { to: new URL(location, SITE).pathname + new URL(location, SITE).search, status: response.status } : null;
}

describe("locale routing", () => {
  it("lets an already-localised path through", () => {
    for (const locale of ["ru", "ukr", "en"]) {
      expect(redirect(proxy(request(`/${locale}/learn`)))).toBeNull();
    }
  });

  it("prefixes a bare path with the cookie's locale", () => {
    expect(redirect(proxy(request("/learn", { locale: "en" })))).toEqual({ to: "/en/learn", status: 307 });
  });

  it("prefers the cookie over Accept-Language", () => {
    const response = proxy(request("/learn", { locale: "en", acceptLanguage: "ru-RU,ru;q=0.9" }));
    expect(redirect(response)?.to).toBe("/en/learn");
  });

  it("falls back to Accept-Language, then to Russian", () => {
    expect(redirect(proxy(request("/learn", { acceptLanguage: "uk-UA" })))?.to).toBe("/ukr/learn");
    expect(redirect(proxy(request("/learn", { acceptLanguage: "ja" })))?.to).toBe("/ru/learn");
    expect(redirect(proxy(request("/learn")))?.to).toBe("/ru/learn");
  });

  it("sends the root to the bare locale", () => {
    expect(redirect(proxy(request("/", { locale: "ru" })))?.to).toBe("/ru");
  });

  it("carries the query string across", () => {
    expect(redirect(proxy(request("/learn?tab=bundles", { locale: "ru" })))?.to).toBe("/ru/learn?tab=bundles");
  });

  it("remembers a resolved locale in a cookie so the guess happens once", () => {
    const response = proxy(request("/learn", { acceptLanguage: "en-GB" }));
    expect(response.cookies.get("aia-locale")?.value).toBe("en");
  });

  it("does not overwrite a locale the visitor already chose", () => {
    const response = proxy(request("/learn", { locale: "en", acceptLanguage: "ru" }));
    expect(response.cookies.get("aia-locale")).toBeUndefined();
  });
});

describe("`/ua` and `/uk`, which people type", () => {
  it("redirects permanently to the `/ukr` segment", () => {
    expect(redirect(proxy(request("/ua/learn")))).toEqual({ to: "/ukr/learn", status: 308 });
    expect(redirect(proxy(request("/uk/learn")))).toEqual({ to: "/ukr/learn", status: 308 });
  });

  it("handles the bare form without leaving a trailing slash", () => {
    expect(redirect(proxy(request("/ua")))?.to).toBe("/ukr");
  });
});

describe("legacy routes", () => {
  it("redirects permanently, so the old URL stops being indexed", () => {
    expect(redirect(proxy(request("/courses", { locale: "ru" })))).toEqual({ to: "/ru/learn", status: 308 });
    expect(redirect(proxy(request("/marketplace", { locale: "ru" })))?.to).toBe("/ru/store");
    expect(redirect(proxy(request("/memberships", { locale: "ru" })))?.to).toBe("/ru/plans");
    expect(redirect(proxy(request("/admin", { locale: "ru" })))?.to).toBe("/ru/studio");
  });

  it("redirects them under an existing locale prefix too", () => {
    expect(redirect(proxy(request("/en/cabinet")))).toEqual({ to: "/en/app", status: 308 });
    expect(redirect(proxy(request("/ukr/oferta")))?.to).toBe("/ukr/legal/offer");
    expect(redirect(proxy(request("/en/impressum")))?.to).toBe("/en/legal/impressum");
  });

  it("keeps the query string on a legacy redirect", () => {
    expect(redirect(proxy(request("/en/blog?page=2")))?.to).toBe("/en/community/blog?page=2");
  });

  it("leaves a path that merely starts with a legacy name alone", () => {
    expect(redirect(proxy(request("/en/blogging")))).toBeNull();
  });
});
