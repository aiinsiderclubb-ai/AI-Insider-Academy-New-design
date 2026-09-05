import path from "node:path";
import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

const here = path.dirname(new URL(import.meta.url).pathname);

/**
 * Hosts the image optimiser is allowed to fetch from.
 *
 * `hostname: "**"` turns the optimiser into an open proxy: anyone can hand it
 * a URL and have arbitrary bytes fetched by this server and served back from
 * our own domain — someone else's traffic on our bill, and a request path into
 * whatever the deployment can reach on the private network.
 *
 * So the list is built from what the product actually renders:
 *
 *  - the API origin, which is where user avatars and any uploaded artwork come
 *    from. Derived rather than hardcoded so staging and production each allow
 *    their own host and nothing else;
 *  - `images.unsplash.com`, used by seeded course artwork;
 *  - anything named in `IMAGE_HOSTS` (comma-separated), the escape hatch for a
 *    CDN that is added without a redeploy of this file. Entries may be a bare
 *    hostname or a full origin when the port or scheme matters:
 *    `cdn.example.com, https://media.example.com:8443`.
 *
 * Course and store covers resolve to local `/public` paths, and `Avatar` falls
 * back to initials when a src fails, so a host missing from this list degrades
 * rather than breaking a page.
 */
function imagePatterns(): RemotePattern[] {
  const patterns = new Map<string, RemotePattern>();

  const add = (value: string, fallbackProtocol: "http" | "https" = "https") => {
    const clean = value.trim();
    if (!clean) return;

    // A bare hostname has no scheme to parse, so one is assumed.
    const url = safeUrl(clean.includes("://") ? clean : `${fallbackProtocol}://${clean}`);
    if (!url) return;

    // `port` is matched exactly, and an omitted one means "no port at all" —
    // so a local API on :3001 has to carry its port through to the pattern.
    const pattern: RemotePattern = {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
    };
    patterns.set(`${pattern.protocol}://${pattern.hostname}:${pattern.port ?? ""}`, pattern);
  };

  add("images.unsplash.com");
  // Same default as `lib/api/http.ts`. On a local checkout this entry is inert:
  // Next refuses to optimise loopback and private addresses regardless of the
  // allowlist (`dangerouslyAllowLocalIP`, off and staying off), so a dev avatar
  // simply falls back to initials. It is what makes staging and production
  // serve their own API's uploads.
  add(process.env.API_ORIGIN ?? "http://localhost:3001", "http");
  for (const host of (process.env.IMAGE_HOSTS ?? "").split(",")) add(host);

  return [...patterns.values()];
}

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    // A malformed entry is the deployment's problem, not the optimiser's —
    // every other host stays allowed.
    return null;
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Pins the workspace to this directory. There is a stray `package-lock.json`
   * in the parent folder, and without this Next walks up to it, warns on every
   * start, and would trace files from outside the repo into the build.
   */
  turbopack: { root: here },
  outputFileTracingRoot: here,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: imagePatterns(),
  },
};

export default nextConfig;
