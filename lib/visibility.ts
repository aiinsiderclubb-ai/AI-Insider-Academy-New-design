/**
 * The courses — and the Club/Pro plans, which only exist to sell them — are
 * hidden until launch: no catalogue, course or plan pages, no listings,
 * counts or links anywhere on the site. Studio still sees everything.
 *
 * Opening them is one variable: COURSES_PUBLIC=1 on Vercel, and the same on
 * the API (Render), whose public catalogue answers empty without it. Anything
 * other than "1" — including unset — keeps them hidden, so a missing variable
 * fails closed.
 */
export function coursesPublic(): boolean {
  return process.env.COURSES_PUBLIC === "1";
}

/** Paths, without the locale, that only make sense once the courses are public. */
export const COURSE_ONLY_PATHS = ["/learn", "/study", "/plans"] as const;

/**
 * The Club and Pro subscriptions have their own switch: they stay hidden while
 * there is no way to pay for them, even with the courses open. PLANS_PUBLIC=1
 * on Vercel shows them; unset keeps them hidden. Hidden means hidden for the
 * courses too — the plans never show before the courses do.
 */
export function plansPublic(): boolean {
  return coursesPublic() && process.env.PLANS_PUBLIC === "1";
}

export function isPlanPath(rest: string): boolean {
  return rest === "/plans" || rest.startsWith("/plans/");
}

export function isCourseOnlyPath(rest: string): boolean {
  return COURSE_ONLY_PATHS.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`));
}

/**
 * Course packs (bundles) and the Vault collection stay off the site until they
 * can be bought: no tabs, sections, links or pack pages. PACKS_PUBLIC=1 on
 * Vercel shows them; unset keeps them hidden.
 */
export function packsPublic(): boolean {
  return coursesPublic() && process.env.PACKS_PUBLIC === "1";
}
