"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "./http";

/** During the launch offer, moves a self-study learner up to the mentor plan for nothing. */
export async function upgradePlanFree(locale: string, courseId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await api("/payments/plan-upgrade", { method: "POST", auth: true, body: { courseId } });
    revalidatePath(`/${locale}`, "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.messageRu ?? error.message };
    return { ok: false, message: "network" };
  }
}
