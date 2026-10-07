import { describe, expect, it } from "vitest";
import { lessonVideoUrl, presignR2Get, r2ConfigFrom, type R2Config } from "@/lib/video/r2";

/**
 * A wrong signature here is not a visible bug — it is every lesson in the
 * course returning 403 from storage, on production, for everyone. So the parts
 * that are easy to get subtly wrong are pinned: which shapes are signed at all,
 * what happens when the bucket is not configured yet, and that the signature
 * itself does not drift.
 */

const CONFIG: R2Config = {
  accountId: "acct123",
  bucket: "academy-video",
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY",
};

/** Fixed clock: SigV4 folds the timestamp into the key, so the output moves without one. */
const NOW = new Date("2026-09-30T17:46:49.000Z");

describe("presignR2Get", () => {
  const url = presignR2Get("first-automation-n8n/fn1.mp4", CONFIG, { now: NOW, expiresIn: 3600 });

  it("addresses the object on the account's R2 endpoint", () => {
    const parsed = new URL(url);
    expect(parsed.host).toBe("acct123.r2.cloudflarestorage.com");
    expect(parsed.pathname).toBe("/academy-video/first-automation-n8n/fn1.mp4");
  });

  it("carries the full set of query parameters R2 checks", () => {
    const query = new URL(url).searchParams;
    expect(query.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(query.get("X-Amz-Credential")).toBe("AKIAEXAMPLE/20260930/auto/s3/aws4_request");
    expect(query.get("X-Amz-Date")).toBe("20260930T174649Z");
    expect(query.get("X-Amz-Expires")).toBe("3600");
    expect(query.get("X-Amz-SignedHeaders")).toBe("host");
    expect(query.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  /**
   * Cross-checked against botocore — the signer AWS itself ships — presigning
   * the same object, bucket, credentials, expiry and timestamp against an R2
   * endpoint in path-style addressing. Matching its output byte for byte is
   * what says this implementation is correct rather than merely stable, and a
   * change that breaks it is a change that would 403 in production.
   */
  it("matches the signature botocore produces for the same request", () => {
    expect(new URL(url).searchParams.get("X-Amz-Signature")).toBe(
      "2d0ec69adbcf34f747f4e006f12408be3f5782d5885952c222dc647f44d77f24",
    );
  });

  /**
   * The encoded path is signed and then requested, so an escaping rule that
   * differs from the storage's own turns into a 403 for exactly the filenames
   * a person is most likely to produce by hand. Both the spelling and the
   * resulting signature are checked against botocore.
   */
  it("escapes the characters encodeURIComponent leaves alone", () => {
    const parsed = new URL(
      presignR2Get("course/lesson(final) v2.mp4", CONFIG, {
        expiresIn: 3600,
        now: new Date("2026-09-30T17:47:26.000Z"),
      }),
    );
    expect(parsed.pathname).toBe("/academy-video/course/lesson%28final%29%20v2.mp4");
    expect(parsed.searchParams.get("X-Amz-Signature")).toBe(
      "543ead48e6e73634ce9fca207b00811245e7ffab2ba41174260748d2a54d7931",
    );
  });

  it("keeps slashes as path separators", () => {
    const parsed = new URL(presignR2Get("a/b/c.mp4", CONFIG, { now: NOW }));
    expect(parsed.pathname).toBe("/academy-video/a/b/c.mp4");
  });
});

describe("r2ConfigFrom", () => {
  const full = {
    R2_ACCOUNT_ID: "acct123",
    R2_BUCKET: "academy-video",
    R2_ACCESS_KEY_ID: "AKIAEXAMPLE",
    R2_SECRET_ACCESS_KEY: "secret",
  };

  it("reads the four values", () => {
    expect(r2ConfigFrom(full)).toEqual({
      accountId: "acct123",
      bucket: "academy-video",
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secret",
    });
  });

  it("treats a blank value as absent, which is what a dashboard sends for an empty field", () => {
    expect(r2ConfigFrom({ ...full, R2_SECRET_ACCESS_KEY: "   " })).toBeNull();
    expect(r2ConfigFrom({ ...full, R2_BUCKET: "" })).toBeNull();
  });

  it("is null when nothing is configured", () => {
    expect(r2ConfigFrom({})).toBeNull();
  });
});

describe("lessonVideoUrl", () => {
  it("has nothing to play for a lesson without a film", () => {
    expect(lessonVideoUrl("", CONFIG)).toBeNull();
    expect(lessonVideoUrl(null, CONFIG)).toBeNull();
    expect(lessonVideoUrl(undefined, CONFIG)).toBeNull();
  });

  it("leaves a public path alone, so the existing trailers keep working", () => {
    expect(lessonVideoUrl("/videos/ai-agent-engineer-promo.mp4", CONFIG)).toBe(
      "/videos/ai-agent-engineer-promo.mp4",
    );
  });

  it("leaves an absolute URL alone", () => {
    expect(lessonVideoUrl("https://cdn.example.com/a.mp4", CONFIG)).toBe("https://cdn.example.com/a.mp4");
  });

  it("signs a bare object key", () => {
    const url = lessonVideoUrl("first-automation-n8n/fn1.mp4", CONFIG, { now: NOW });
    expect(url).toContain("acct123.r2.cloudflarestorage.com");
    expect(url).toContain("X-Amz-Signature=");
  });

  /** Half-configured must show the "coming soon" frame, never a player that 403s. */
  it("declines to invent a URL when the bucket is not set up", () => {
    expect(lessonVideoUrl("first-automation-n8n/fn1.mp4", null)).toBeNull();
  });
});
