import { isIP } from "node:net";

/**
 * The visitor's address, as the hosting platform reports it.
 *
 * Vercel sets `x-real-ip` and overwrites `x-forwarded-for` on the way in, so a
 * browser cannot forge either; the first hop of `x-forwarded-for` is only a
 * fallback for hosts that set that one alone. Anything that does not parse as
 * a single address is dropped rather than passed along.
 */
export function clientIpFrom(headers: Headers): string | null {
  const candidates = [headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && isIP(ip)) return ip;
  }
  return null;
}

/**
 * Headers that let the API trust the address above.
 *
 * The API calls from this server, so without them every visitor looks like
 * the same few addresses and each of the API's IP-keyed limits — all of
 * /auth among them — becomes one bucket for the whole site. The shared secret
 * is what separates this server from anyone calling the API directly. Until
 * WEB_PROXY_SECRET is configured this returns nothing and behaviour is as
 * before.
 */
export function webProxyHeaders(ip: string | null): Record<string, string> {
  const secret = process.env.WEB_PROXY_SECRET?.trim();
  if (!secret || !ip) return {};
  return { "x-client-ip": ip, "x-web-proxy-secret": secret };
}
