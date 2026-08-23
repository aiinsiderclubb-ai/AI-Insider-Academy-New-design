"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "./http";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

function fail(error: unknown): ActionResult {
  if (error instanceof ApiError) return { ok: false, message: error.messageRu ?? error.message };
  return { ok: false, message: "network" };
}

function refresh(locale: string) {
  revalidatePath(`/${locale}/studio`, "layout");
}

/* -------------------------------- homework -------------------------------- */

export async function reviewHomework(
  locale: string,
  id: string,
  status: "accepted" | "resubmit",
  adminComment?: string,
): Promise<ActionResult> {
  try {
    await api(`/admin/homework/${encodeURIComponent(id)}`, {
      admin: true,
      method: "PATCH",
      body: { status, adminComment: adminComment || undefined },
    });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------- applications ------------------------------ */

export async function decideApplication(
  locale: string,
  id: string,
  decision: "approve" | "reject",
): Promise<ActionResult> {
  try {
    await api(`/admin/applications/${encodeURIComponent(id)}/${decision}`, { admin: true, method: "POST" });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------- reviews --------------------------------- */

export async function moderateReview(
  locale: string,
  id: string,
  status: "approved" | "rejected" | "pending",
): Promise<ActionResult> {
  try {
    await api(`/admin/reviews/${encodeURIComponent(id)}`, { admin: true, method: "PATCH", body: { status } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------- access ---------------------------------- */

export async function grantCourse(locale: string, email: string, courseId: string): Promise<ActionResult> {
  try {
    await api("/admin/grant-course", { admin: true, method: "POST", body: { email, courseId } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function unlockLesson(
  locale: string,
  email: string,
  courseId: string,
  lessonIndex: number,
): Promise<ActionResult> {
  try {
    await api("/admin/unlock-lesson", { admin: true, method: "POST", body: { email, courseId, lessonIndex } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------- promo codes ------------------------------ */

export async function createPromoCode(
  locale: string,
  input: { code: string; percent?: number; amountEur?: number; courseId?: string; maxUses?: number; expiresAt?: string },
): Promise<ActionResult> {
  try {
    await api("/admin/promo-codes", { admin: true, method: "POST", body: input });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function togglePromoCode(locale: string, code: string, active: boolean): Promise<ActionResult> {
  try {
    await api(`/admin/promo-codes/${encodeURIComponent(code)}`, { admin: true, method: "PATCH", body: { active } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------ feature flags ------------------------------ */

export async function setFeatureFlag(locale: string, key: string, value: boolean): Promise<ActionResult> {
  try {
    await api("/admin/feature-flags", { admin: true, method: "PUT", body: { [key]: value } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------- giveaways -------------------------------- */

export async function drawGiveaway(locale: string, slug: string): Promise<ActionResult> {
  try {
    await api(`/admin/giveaways/${encodeURIComponent(slug)}/draw`, { admin: true, method: "POST" });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function publishGiveaway(locale: string, slug: string): Promise<ActionResult> {
  try {
    await api(`/admin/giveaways/${encodeURIComponent(slug)}/publish`, { admin: true, method: "POST" });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
