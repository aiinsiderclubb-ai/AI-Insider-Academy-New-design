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

export function isCourseOnlyPath(rest: string): boolean {
  return COURSE_ONLY_PATHS.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`));
}
