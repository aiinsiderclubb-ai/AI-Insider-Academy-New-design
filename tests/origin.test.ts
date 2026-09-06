import { describe, expect, it } from "vitest";
import { resolveApiOrigin, resolveSiteUrl } from "@/lib/api/origin";

/**
 * These two functions exist because of one real deployment failure: a hosting
 * dashboard handed the build an `API_ORIGIN` that was present but empty, `??`
 * let it through, every request became a relative URL, and the prerender hung
 * for sixty seconds per page before the build died. The empty-string cases
 * below are the regression.
 */
describe("resolveApiOrigin", () => {
  it("keeps a valid origin", () => {
    expect(resolveApiOrigin("https://api.example.com")).toBe("https://api.example.com");
    expect(resolveApiOrigin("http://localhost:3001")).toBe("http://localhost:3001");
    expect(resolveApiOrigin("https://api.example.com:8443")).toBe("https://api.example.com:8443");
  });

  it("drops a trailing slash and any path, so `/api` is never doubled", () => {
    expect(resolveApiOrigin("https://api.example.com/")).toBe("https://api.example.com");
    expect(resolveApiOrigin("https://api.example.com/v1/")).toBe("https://api.example.com");
  });

  it("treats a present-but-empty value as absent", () => {
    // The bug: `??` only replaces null and undefined.
    expect(resolveApiOrigin("")).toBe("http://localhost:3001");
    expect(resolveApiOrigin("   ")).toBe("http://localhost:3001");
    expect(resolveApiOrigin(undefined)).toBe("http://localhost:3001");
  });

  it("refuses anything that is not an absolute http(s) origin", () => {
    // Each of these would otherwise produce a relative request URL.
    expect(resolveApiOrigin("example.com")).toBe("http://localhost:3001");
    expect(resolveApiOrigin("/api")).toBe("http://localhost:3001");
    expect(resolveApiOrigin("not a url")).toBe("http://localhost:3001");
    expect(resolveApiOrigin("ftp://api.example.com")).toBe("http://localhost:3001");
    expect(resolveApiOrigin("javascript:alert(1)")).toBe("http://localhost:3001");
  });

  it("tolerates surrounding whitespace", () => {
    expect(resolveApiOrigin("  https://api.example.com  ")).toBe("https://api.example.com");
  });
});

describe("resolveSiteUrl", () => {
  it("keeps a valid site URL", () => {
    expect(resolveSiteUrl("https://academy.example.com")).toBe("https://academy.example.com");
  });

  it("never throws on an empty or malformed value", () => {
    // `new URL("")` throws, and this one is read while building metadata —
    // it would take the whole build down rather than degrade.
    expect(resolveSiteUrl("")).toBe("https://myinsideracademy.com");
    expect(resolveSiteUrl("   ")).toBe("https://myinsideracademy.com");
    expect(resolveSiteUrl("not a url")).toBe("https://myinsideracademy.com");
    expect(resolveSiteUrl(undefined)).toBe("https://myinsideracademy.com");
  });

  it("normalises to an origin", () => {
    expect(resolveSiteUrl("https://academy.example.com/ru/")).toBe("https://academy.example.com");
  });
});
