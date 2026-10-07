import "server-only";
import { createHash, createHmac } from "node:crypto";

/**
 * Presigned URLs for lesson videos held in Cloudflare R2.
 *
 * Lesson files are too large to live in the repository and must not be
 * permanently public: a `/public` path is readable by anyone who has ever seen
 * it, forever, which makes the player's `nodownload` purely cosmetic. So the
 * content JSON stores an *object key* and the server mints a short-lived signed
 * URL each time a learner opens the lesson. A link that leaks stops working on
 * its own.
 *
 * R2 speaks the S3 API, so this is AWS Signature Version 4 in its query-string
 * form. It is written out here rather than pulled from `@aws-sdk/*` because the
 * SDK is tens of megabytes to sign a string with four HMACs, and this file is
 * the only thing in the app that needs it.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
/** R2 has no regions, but SigV4 requires one and R2 expects this literal. */
const REGION = "auto";
const SERVICE = "s3";

/** Long enough for a 20-minute lesson with pauses, short enough that a copied link dies the same day. */
export const DEFAULT_EXPIRES_IN = 6 * 60 * 60;

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Reads the four values the signer needs, treating blank as absent.
 *
 * A hosting dashboard hands you an empty string for a field left blank, and an
 * empty secret would otherwise produce a URL that looks valid and 403s on every
 * viewer. Returning `null` instead lets the caller fall back to the player's
 * "video coming soon" frame, which is the honest thing to show while the bucket
 * is still being set up.
 */
export function r2ConfigFrom(env: Record<string, string | undefined> = process.env): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

/**
 * RFC 3986 encoding, which is stricter than `encodeURIComponent`.
 *
 * The four characters below are "unreserved marks" that `encodeURIComponent`
 * leaves alone and AWS requires escaped. A key containing one of them — say
 * `lesson(final).mp4` — would otherwise be signed in one spelling and requested
 * in another, and the signature would not match.
 */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Slashes separate path segments and stay literal; everything inside one is escaped. */
function encodeKeyPath(key: string): string {
  return key.split("/").map(uriEncode).join("/");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Signs a GET for one object and returns the URL to hand the `<video>` element.
 *
 * `now` is injectable so the signature can be pinned in a test; production
 * always passes the real clock.
 */
export function presignR2Get(
  key: string,
  config: R2Config,
  { expiresIn = DEFAULT_EXPIRES_IN, now = new Date() }: { expiresIn?: number; now?: Date } = {},
): string {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  // Path-style addressing: R2 supports it and it avoids depending on a bucket
  // name that is a valid DNS label.
  const canonicalUri = `/${uriEncode(config.bucket)}/${encodeKeyPath(key)}`;

  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  // Query parameters must be sorted by name; these already are, but the sort
  // keeps that true if one is ever added.
  const query = new Map<string, string>([
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ]);
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${uriEncode(name)}=${uriEncode(value)}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    // The body is empty and its hash is not covered for presigned GETs.
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  // The signing key is the secret walked through date, region and service, so
  // a leaked signature is only ever good for one day of one service.
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Turns whatever the content stores into something the player can load.
 *
 * Three shapes reach this function and each means something different:
 *
 *  - empty — the lesson has no film yet, and the player says so;
 *  - an absolute URL or a `/public` path — used as-is, which is how the
 *    existing course trailers under `/videos` keep working untouched;
 *  - anything else — an R2 object key, signed here.
 *
 * With R2 unconfigured a key resolves to `null` rather than a broken URL, so a
 * half-finished deployment shows the "coming soon" frame instead of a player
 * that fails to load.
 */
export function lessonVideoUrl(
  raw: string | null | undefined,
  config: R2Config | null = r2ConfigFrom(),
  options?: { expiresIn?: number; now?: Date },
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  if (!config) return null;
  return presignR2Get(value, config, options);
}
