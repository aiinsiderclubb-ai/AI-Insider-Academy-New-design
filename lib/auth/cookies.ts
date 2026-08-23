import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "aia_session";
export const ADMIN_COOKIE = "aia_admin";

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const EIGHT_HOURS = 60 * 60 * 8;

/**
 * The API issues a JWT. The old client kept it in localStorage, where any
 * injected script could read it; here it lives in an httpOnly cookie and the
 * token only ever travels server-side.
 */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionToken(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearSessionToken() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readAdminToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value ?? null;
}

export async function writeAdminToken(token: string) {
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EIGHT_HOURS,
  });
}

export async function clearAdminToken() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
