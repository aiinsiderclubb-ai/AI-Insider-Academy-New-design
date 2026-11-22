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

/** Gives a course, pack, vault, bundle or store product to a learner by hand. */
export async function grantItem(locale: string, userId: number, itemId: string, licenseTier?: string): Promise<ActionResult> {
  try {
    await api("/admin/entitlements", { admin: true, method: "POST", body: { userId, itemId, licenseTier } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeGrant(
  locale: string,
  userId: number,
  target: { purchaseId?: number; entitlementId?: string },
): Promise<ActionResult> {
  try {
    await api("/admin/entitlements/revoke", { admin: true, method: "POST", body: { userId, ...target } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteLearner(locale: string, userId: number): Promise<ActionResult> {
  try {
    await api("/admin/users/delete", { admin: true, method: "POST", body: { userId } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Takes back what an order gave. The money is refunded in the provider's dashboard. */
export async function revokeOrder(locale: string, paymentId: string, reason?: string): Promise<ActionResult> {
  try {
    await api(`/admin/orders/${encodeURIComponent(paymentId)}/revoke`, { admin: true, method: "POST", body: { reason } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function replySupport(locale: string, id: string, reply: string): Promise<ActionResult> {
  try {
    await api(`/admin/support/${encodeURIComponent(id)}/reply`, { admin: true, method: "POST", body: { reply } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------- promo codes ------------------------------ */

export interface PromoInput {
  code: string;
  discountPercent?: number | null;
  discountEur?: number | null;
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  courseIds?: string[];
}

export async function createPromoCode(locale: string, input: PromoInput): Promise<ActionResult> {
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

/* ---------------------------------- mail ---------------------------------- */

export async function previewEmailTemplate(template: string, locale: string) {
  try {
    const qs = new URLSearchParams({ template, locale }).toString();
    return await api<{ subject: string; html: string; marketing?: boolean }>(
      `/admin/email/preview?${qs}`,
      { admin: true },
    );
  } catch (error) {
    return { subject: "", html: "", error: fail(error).message };
  }
}

export async function sendStudioTestEmail(
  locale: string,
  email: string,
  template: string,
): Promise<ActionResult> {
  try {
    await api("/admin/email/test", { admin: true, method: "POST", body: { email, template, locale } });
    refresh(locale);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
