const FALLBACK = "http://localhost:3001";

/**
 * Where the Express API lives, resolved from the environment.
 *
 * `process.env.API_ORIGIN ?? FALLBACK` is not enough, and the difference is
 * not academic: `??` only replaces `null` and `undefined`, so an environment
 * variable that exists but is empty — which is what a hosting dashboard hands
 * you when the field is left blank — passes straight through. Every request
 * then builds a *relative* URL like `/api/courses`. Plain `fetch` rejects that
 * immediately, but the instrumented fetch Next uses while prerendering does
 * not: the page simply never resolves, and a build dies sixty seconds later
 * per page with nothing pointing at the cause.
 *
 * So anything that is not an absolute http(s) origin is treated as absent.
 * Falling back to a host that refuses the connection is recoverable — every
 * call goes through `tryApi` and lands on local content. Silently building
 * relative URLs is not.
 */
export function resolveApiOrigin(raw: string | undefined = process.env.API_ORIGIN): string {
  const value = raw?.trim();
  if (!value) return FALLBACK;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return FALLBACK;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return FALLBACK;

  // A trailing slash would double up against the `/api${path}` that callers
  // append, and some servers treat `//api` as a different route.
  return url.origin;
}

/**
 * The public address of this site, used for canonical links, the sitemap and
 * Open Graph tags. Same trap as above, with a sharper edge: `new URL("")`
 * throws, so an empty `SITE_URL` takes the whole build down at metadata.
 */
export function resolveSiteUrl(raw: string | undefined = process.env.SITE_URL): string {
  const value = raw?.trim();
  const fallback = "https://myinsideracademy.com";
  if (!value) return fallback;

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}
