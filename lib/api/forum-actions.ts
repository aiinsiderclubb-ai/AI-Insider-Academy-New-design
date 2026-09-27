"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "./http";

export interface ModerationResult {
  ok: boolean;
  message?: string;
}

type TopicChanges = Partial<Record<"isPinned" | "isLocked" | "isHidden", boolean>>;

const TOPIC_FIELDS = ["isPinned", "isLocked", "isHidden"] as const;

function fail(error: unknown): ModerationResult {
  if (error instanceof ApiError) return { ok: false, message: error.messageRu ?? error.message };
  return { ok: false, message: "network" };
}

/*
 * A server action is a public endpoint: anyone holding the page can call it
 * with any arguments. The API is what actually refuses a non-moderator — the
 * admin bearer lives in an httpOnly cookie and is attached in `api()` — but
 * the arguments are still narrowed here so nothing unexpected is forwarded.
 */

export async function moderateTopic(locale: string, topicId: string, changes: TopicChanges): Promise<ModerationResult> {
  if (typeof topicId !== "string" || !topicId) return { ok: false, message: "invalid" };
  const body: TopicChanges = {};
  for (const field of TOPIC_FIELDS) {
    if (typeof changes?.[field] === "boolean") body[field] = changes[field];
  }
  if (!Object.keys(body).length) return { ok: false, message: "invalid" };

  try {
    await api(`/admin/forum/topics/${encodeURIComponent(topicId)}`, { admin: true, method: "PATCH", body });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/${locale}/community/forum`, "layout");
  return { ok: true };
}

export async function moderatePost(locale: string, postId: string, isHidden: boolean): Promise<ModerationResult> {
  if (typeof postId !== "string" || !postId || typeof isHidden !== "boolean") return { ok: false, message: "invalid" };

  try {
    await api(`/admin/forum/posts/${encodeURIComponent(postId)}`, {
      admin: true,
      method: "PATCH",
      body: { isHidden },
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/${locale}/community/forum`, "layout");
  return { ok: true };
}
