/**
 * Which credential the API proxy may attach to a given path.
 *
 * The proxy holds two cookies — the visitor's session and the admin session —
 * and has to pick one per request. Picking by string prefix is only safe while
 * the list is complete: an admin endpoint that appears under a prefix nobody
 * added here would quietly receive the *visitor's* bearer instead, and from
 * then on the only thing standing between a logged-in learner and an admin
 * route is whatever the API happens to check.
 *
 * So the decision is made in two passes rather than one:
 *
 *  - `ADMIN_SEGMENTS` — known admin routers. These get the admin token, and
 *    never the session token.
 *  - `PRIVILEGED_SEGMENTS` — the wider set of names an internal route is
 *    likely to live under. A path that matches one of these but is not a known
 *    admin router is treated as unknown-privileged and gets **no** credential
 *    at all. The request fails with a 401 that is obvious in the browser,
 *    instead of succeeding with the wrong identity.
 *
 * Adding a route to the API means adding its segment here. That is the point:
 * the failure mode is a visible 401, not a silent privilege mix-up.
 */

/** Routers that require the admin bearer. */
export const ADMIN_SEGMENTS = ["admin", "governance", "n8n"] as const;

/** Names an internal route may appear under. A superset of the above. */
export const PRIVILEGED_SEGMENTS = [
  ...ADMIN_SEGMENTS,
  "studio",
  "internal",
  "ops",
  "moderation",
  "metrics",
] as const;

export type Scope =
  /** Attach the admin bearer. */
  | "admin"
  /** Attach the visitor's bearer, if they have one. */
  | "session"
  /** Attach nothing: the path looks privileged but is not a known admin route. */
  | "none";

/**
 * `path` is the API path with no leading slash, as the catch-all route
 * produces it — `admin/dashboard`, `me/profile`.
 */
export function scopeFor(path: string): Scope {
  const first = path.split("/", 1)[0]?.toLowerCase() ?? "";
  if ((ADMIN_SEGMENTS as readonly string[]).includes(first)) return "admin";
  if ((PRIVILEGED_SEGMENTS as readonly string[]).includes(first)) return "none";
  return "session";
}
