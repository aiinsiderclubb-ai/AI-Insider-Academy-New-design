import "server-only";
import { cache } from "react";
import { tryApi } from "./http";
import type { ApiCertificate, ApiNotification, ApiUser } from "./types";

export interface CourseProgress {
  /** Zero-based indexes of lessons the learner has finished. */
  watched: number[];
  /** Lesson indexes whose assignment has been accepted. */
  homeworkChecked: number[];
  lastLessonIndex?: number;
  updatedAt?: string;
}

export interface Purchase {
  id: string;
  purchasedAt: string;
}

export interface Achievement {
  id: string;
  title?: string;
  titleRu?: string;
  description?: string;
}

export interface MeResponse {
  user: ApiUser;
  purchases: Purchase[];
  progress: Record<string, CourseProgress>;
  discountPercent: number;
  streak: { current: number; best?: number };
  achievements: Achievement[];
  /** Sales and entitlements are frozen until the platform launches. */
  prelaunch: boolean;
}

const EMPTY: MeResponse = {
  user: { id: 0, email: "", name: "", personalId: "", emailVerified: false },
  purchases: [],
  progress: {},
  discountPercent: 0,
  streak: { current: 0, best: 0 },
  achievements: [],
  prelaunch: false,
};

/**
 * One session probe per request. The old app fired `/api/me` twice and
 * `/api/health` five times on every navigation; React's `cache` collapses
 * repeat calls from any number of components into a single fetch.
 */
export const getMe = cache(async (): Promise<MeResponse | null> => {
  const payload = await tryApi<MeResponse | null>("/me", { auth: true, soft: true }, null);
  return payload?.user ? payload : null;
});

export const getSession = cache(async (): Promise<ApiUser | null> => {
  const me = await getMe();
  return me?.user ?? null;
});

export const getNotifications = cache(async (): Promise<ApiNotification[]> => {
  const payload = await tryApi<ApiNotification[] | { notifications?: ApiNotification[] }>(
    "/me/notifications",
    { auth: true, soft: true },
    [],
  );
  return Array.isArray(payload) ? payload : (payload.notifications ?? []);
});

export const getCertificates = cache(async (): Promise<ApiCertificate[]> => {
  const payload = await tryApi<ApiCertificate[] | { certificates?: ApiCertificate[] }>(
    "/me/certificates",
    { auth: true, soft: true },
    [],
  );
  return Array.isArray(payload) ? payload : (payload.certificates ?? []);
});

export const getStats = cache(async () =>
  tryApi<{ chart: { courseId: string; percent: number }[]; streak: { current: number; lastActivity: string | null } }>(
    "/me/stats",
    { auth: true, soft: true },
    { chart: [], streak: { current: 0, lastActivity: null } },
  ),
);

export const getTeam = cache(async () =>
  tryApi<{ team: { id: number; name: string; inviteCode: string; role?: string } | null; members: unknown[] }>(
    "/teams/my",
    { auth: true, soft: true },
    { team: null, members: [] },
  ),
);

export const getSupportThread = cache(async () =>
  tryApi<{ id: number; body: string; fromSupport?: boolean; createdAt: string }[]>(
    "/me/support",
    { auth: true, soft: true },
    [],
  ),
);

/** Marketplace entitlements are optional: the endpoint can fail independently. */
export const getEntitlements = cache(async () => {
  const payload = await tryApi<{ items?: { productId: string; license: string }[] } | { error: string }>(
    "/marketplace/me/entitlements",
    { auth: true, soft: true },
    {},
  );
  if (!payload || "error" in payload) return [] as { productId: string; license: string }[];
  return payload.items ?? [];
});

export const getDownloads = cache(async () => {
  const payload = await tryApi<{ items?: unknown[] } | { error: string }>(
    "/marketplace/me/downloads",
    { auth: true, soft: true },
    {},
  );
  if (!payload || "error" in payload) return [] as unknown[];
  return payload.items ?? [];
});

/* -------------------------------------------------------------------------- */

export interface Access {
  signedIn: boolean;
  tier: "guest" | "free" | "club" | "pro";
  courseIds: Set<string>;
  productIds: Set<string>;
  progress: Record<string, CourseProgress>;
  /** True while the platform is in prelaunch: purchases are frozen API-side. */
  prelaunch: boolean;
  discountPercent: number;
}

const GUEST: Access = {
  signedIn: false,
  tier: "guest",
  courseIds: new Set(),
  productIds: new Set(),
  progress: {},
  prelaunch: false,
  discountPercent: 0,
};

/**
 * Single place that answers "can this person open this?". The old platform
 * spread the rules across components, which is how an account labelled
 * "All Access" ended up hitting a paywall inside the player.
 */
export const getAccess = cache(async (): Promise<Access> => {
  const me = await getMe();
  if (!me) return GUEST;

  const entitlements = await getEntitlements();
  const role = String(me.user.role ?? "").toLowerCase();
  const tier: Access["tier"] = role.includes("pro") ? "pro" : role.includes("club") ? "club" : "free";

  return {
    signedIn: true,
    tier,
    courseIds: new Set(me.purchases.map((purchase) => purchase.id)),
    productIds: new Set(entitlements.map((item) => item.productId)),
    progress: me.progress,
    prelaunch: me.prelaunch,
    discountPercent: me.discountPercent,
  };
});

export function canOpenLesson(
  access: Access,
  course: { id: string; isFree: boolean; isProOnly: boolean; inClub: boolean },
  lessonIndex: number,
): boolean {
  if (course.isFree) return true;
  if (lessonIndex === 0) return true; // the first lesson is always a free sample
  if (!access.signedIn) return false;
  if (access.courseIds.has(course.id)) return true;
  if (access.tier === "pro") return true;
  if (access.tier === "club") return course.inClub && !course.isProOnly;
  return false;
}

export function courseCompletion(access: Access, courseId: string, lessonCount: number) {
  const watched = access.progress[courseId]?.watched ?? [];
  const done = new Set(watched).size;
  return { done, total: lessonCount, percent: lessonCount ? Math.round((done / lessonCount) * 100) : 0 };
}
