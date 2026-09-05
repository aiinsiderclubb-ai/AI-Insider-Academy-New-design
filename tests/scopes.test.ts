import { describe, expect, it } from "vitest";
import { ADMIN_SEGMENTS, PRIVILEGED_SEGMENTS, scopeFor } from "@/lib/auth/scopes";

/**
 * The proxy attaches one of two bearers by path. Getting this wrong once means
 * a learner's token reaching an admin router, so the interesting cases are the
 * paths that only *look* like something.
 */
describe("scopeFor", () => {
  it("sends the admin bearer to the known admin routers", () => {
    expect(scopeFor("admin/dashboard")).toBe("admin");
    expect(scopeFor("governance/dashboard")).toBe("admin");
    expect(scopeFor("n8n/workflows/42")).toBe("admin");
  });

  it("sends the visitor's bearer to ordinary routes", () => {
    expect(scopeFor("me/profile")).toBe("session");
    expect(scopeFor("forum/topics")).toBe("session");
    expect(scopeFor("payments/stripe/checkout")).toBe("session");
    expect(scopeFor("")).toBe("session");
  });

  it("withholds both from a privileged-looking path that is not a known router", () => {
    // The failure mode is a visible 401, never the wrong identity.
    expect(scopeFor("studio/queue")).toBe("none");
    expect(scopeFor("internal/flags")).toBe("none");
    expect(scopeFor("ops/restart")).toBe("none");
    expect(scopeFor("moderation/reports")).toBe("none");
    expect(scopeFor("metrics/revenue")).toBe("none");
  });

  it("matches whole segments, not prefixes", () => {
    // `administrators` is not `admin`; neither should borrow the other's token.
    expect(scopeFor("administrators/list")).toBe("session");
    expect(scopeFor("n8n-status")).toBe("session");
    expect(scopeFor("me/admin-notes")).toBe("session");
  });

  it("is case-insensitive on the first segment", () => {
    expect(scopeFor("Admin/dashboard")).toBe("admin");
    expect(scopeFor("GOVERNANCE/dashboard")).toBe("admin");
  });

  it("keeps every admin router inside the privileged set", () => {
    for (const segment of ADMIN_SEGMENTS) {
      expect(PRIVILEGED_SEGMENTS).toContain(segment);
    }
  });
});
