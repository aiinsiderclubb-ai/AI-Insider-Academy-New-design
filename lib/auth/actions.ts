"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api/http";
import { clearAdminToken, clearSessionToken, writeAdminToken, writeSessionToken } from "./cookies";
import { safeNext } from "./redirects";
import type { ApiUser } from "@/lib/api/types";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

export interface AuthResult {
  ok: boolean;
  /** Localised message from the API, ready to render. */
  message?: string;
  /** The account exists but the address has not been confirmed yet. */
  requiresVerification?: boolean;
  email?: string;
}

function localeOf(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? "");
  return isLocale(raw) ? raw : defaultLocale;
}

function describe(error: unknown): AuthResult {
  if (error instanceof ApiError) {
    return {
      ok: false,
      message: error.messageRu ?? error.message,
      requiresVerification: error.status === 403,
    };
  }
  return { ok: false, message: "network" };
}

/* ------------------------------- sign in --------------------------------- */

export async function signIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = localeOf(formData.get("locale"));
  const next = safeNext(formData.get("next"), locale);

  try {
    const result = await api<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await writeSessionToken(result.token);
  } catch (error) {
    return { ...describe(error), email };
  }

  redirect(next);
}

/* ------------------------------- sign up --------------------------------- */

export async function signUp(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const locale = localeOf(formData.get("locale"));

  try {
    await api("/auth/register", { method: "POST", body: { email, password, name, locale } });
  } catch (error) {
    return { ...describe(error), email };
  }

  // Registration always ends at verification: the API refuses login until the
  // address is confirmed, so sending people to /login would be a dead end.
  redirect(`/${locale}/verify-email?email=${encodeURIComponent(email)}`);
}

/* ----------------------------- verification ------------------------------ */

export async function verifyEmail(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const locale = localeOf(formData.get("locale"));

  try {
    const result = await api<{ token?: string }>("/auth/verify-email-code", {
      method: "POST",
      body: { email, code },
    });
    if (result.token) await writeSessionToken(result.token);
  } catch (error) {
    return { ...describe(error), email };
  }

  redirect(`/${locale}/onboarding`);
}

export async function resendCode(email: string): Promise<AuthResult> {
  try {
    await api("/auth/resend-verification-code", { method: "POST", body: { email } });
    return { ok: true };
  } catch (error) {
    return describe(error);
  }
}

/* ------------------------------- password -------------------------------- */

export async function requestPasswordReset(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  try {
    await api("/auth/forgot-password", { method: "POST", body: { email } });
  } catch {
    // A reset form must not reveal whether an address is registered.
  }
  return { ok: true, email };
}

export async function resetPassword(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const locale = localeOf(formData.get("locale"));

  try {
    await api("/auth/reset-password", { method: "POST", body: { token, password } });
  } catch (error) {
    return describe(error);
  }

  redirect(`/${locale}/login?reset=1`);
}

/* -------------------------------- sign out -------------------------------- */

export async function signOut(locale: Locale = defaultLocale) {
  await clearSessionToken();
  redirect(`/${locale}`);
}

/* --------------------------------- admin ---------------------------------- */

export async function adminSignIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const locale = localeOf(formData.get("locale"));

  try {
    const result = await api<{ token: string; role: string }>("/admin/login", {
      method: "POST",
      body: { password },
    });
    await writeAdminToken(result.token);
  } catch (error) {
    return describe(error);
  }

  redirect(`/${locale}/studio`);
}

export async function adminSignOut(locale: Locale = defaultLocale) {
  await clearAdminToken();
  redirect(`/${locale}/studio`);
}
