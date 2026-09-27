import { afterEach, describe, expect, it } from "vitest";
import { clientIpFrom, webProxyHeaders } from "@/lib/api/client-ip";

/**
 * The address sent to the API decides whose bucket a rate limit fills. If it
 * is wrong, one visitor's retries lock out everyone — so the parsing is worth
 * pinning down, including the inputs that must be refused.
 */
describe("clientIpFrom", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("prefers x-real-ip, which the host sets itself", () => {
    expect(clientIpFrom(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.7");
  });

  it("falls back to the first hop of x-forwarded-for", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1, 10.0.0.2" }))).toBe("198.51.100.1");
  });

  it("accepts IPv6", () => {
    expect(clientIpFrom(h({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("drops anything that is not a single address", () => {
    expect(clientIpFrom(h({ "x-real-ip": "not-an-ip" }))).toBeNull();
    expect(clientIpFrom(h({ "x-real-ip": "203.0.113.7 evil" }))).toBeNull();
    expect(clientIpFrom(h({}))).toBeNull();
  });

  it("moves on to the fallback when x-real-ip is garbage", () => {
    expect(clientIpFrom(h({ "x-real-ip": "garbage", "x-forwarded-for": "198.51.100.1" }))).toBe("198.51.100.1");
  });
});

describe("webProxyHeaders", () => {
  const previous = process.env.WEB_PROXY_SECRET;
  afterEach(() => {
    if (previous === undefined) delete process.env.WEB_PROXY_SECRET;
    else process.env.WEB_PROXY_SECRET = previous;
  });

  it("sends nothing until the secret is configured, so behaviour is unchanged", () => {
    delete process.env.WEB_PROXY_SECRET;
    expect(webProxyHeaders("203.0.113.7")).toEqual({});
    process.env.WEB_PROXY_SECRET = "   ";
    expect(webProxyHeaders("203.0.113.7")).toEqual({});
  });

  it("sends nothing without an address", () => {
    process.env.WEB_PROXY_SECRET = "s3cret";
    expect(webProxyHeaders(null)).toEqual({});
  });

  it("vouches for the address with the secret", () => {
    process.env.WEB_PROXY_SECRET = "s3cret";
    expect(webProxyHeaders("203.0.113.7")).toEqual({ "x-client-ip": "203.0.113.7", "x-web-proxy-secret": "s3cret" });
  });
});
