/**
 * Stands in for the `server-only` package under Vitest.
 *
 * The real package throws on import outside a React Server Component, which is
 * exactly the guard we want in the build and exactly what stops a server module
 * from being imported by a test. Aliasing it here disarms it for the test run
 * only; `next build` still resolves the real package, so a client component that
 * imports a server module fails the same way it always did.
 */
export const disarmed = true;
