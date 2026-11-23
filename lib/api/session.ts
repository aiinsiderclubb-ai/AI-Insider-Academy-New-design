import "server-only";
import { cache } from "react";
import { DEMO_HOURS } from "@/lib/demo";
import { tryApi } from "./http";
import type { ApiCertificate, ApiNotification, ApiUser } from "./types";

export interface CourseProgress {
  /** Zero-based indexes of lessons the learner has finished. */
  watched: number[];
  /** Lesson indexes whose assignment has been accepted. */
  homeworkChecked: number[];
  lastLessonIndex?: number;
  updatedAt?: string;
  /** When the learner first opened the free demo lesson of a course they do not own. */
  demoStartedAt?: string;
}

/**
 * A paid course is bought in one of two plans: `self` (every lesson, the
 * learner checks their own assignments) or `mentor` (assignments reviewed,
 * a mentor to ask). Purchases from before plans existed count as `mentor`.
 */
export type CoursePlan = "self" | "mentor";

export interface Purchase {
  id: string;
  purchasedAt: string;
  plan?: CoursePlan;
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

export interface RewardCode {
  code: string;
  percent: number;
  kind: "next" | "referrer";
  validFrom: string | null;
  validUntil: string | null;
  status: "active" | "pending" | "used" | "expired" | "cancelled";
}

export interface Rewards {
  referralCode: string | null;
  friendPercent: number;
  referrerPercent: number;
  nextPercent: number;
  invited: number;
  purchased: number;
  friendDiscount: number;
  codes: RewardCode[];
}

/** Referral link code, who came by it, and the discount codes this person holds. */
export const getRewards = cache(async () => tryApi<Rewards | null>("/me/rewards", { auth: true, soft: true }, null));

/**
 * The API stores a question and the team's reply on one row; the thread shows
 * them as separate bubbles, the reply right after its question.
 */
export const getSupportThread = cache(async () => {
  const rows = await tryApi<{ id: string; message: string; reply?: string | null; date: string }[]>(
    "/me/support",
    { auth: true, soft: true },
    [],
  );
  return (Array.isArray(rows) ? rows : []).flatMap((row) => [
    { id: row.id, body: row.message, fromSupport: false, createdAt: row.date },
    ...(row.reply ? [{ id: `${row.id}-reply`, body: row.reply, fromSupport: true, createdAt: row.date }] : []),
  ]);
});

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
  /** Owned courses bought in the self-study plan: no assignment review, no mentor. */
  selfPlanIds: Set<string>;
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
  selfPlanIds: new Set(),
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
    selfPlanIds: new Set(me.purchases.filter((purchase) => purchase.plan === "self").map((purchase) => purchase.id)),
    productIds: new Set(entitlements.map((item) => item.productId)),
    progress: me.progress,
    prelaunch: me.prelaunch,
    discountPercent: me.discountPercent,
  };
});

type AccessCourse = { id: string; isFree: boolean; isProOnly: boolean; inClub: boolean };

/** Every lesson of the course is open to this person: bought, or covered by their plan. */
function hasFullAccess(access: Access, course: AccessCourse): boolean {
  if (!access.signedIn) return false;
  if (access.courseIds.has(course.id)) return true;
  if (access.tier === "pro") return true;
  if (access.tier === "club") return course.inClub && !course.isProOnly;
  return false;
}

/**
 * Where a learner stands with a paid course's free demo lesson.
 *
 * "One demo per course per account" is a window rather than a single view: the
 * clock starts the first time lesson 1 is opened and runs for DEMO_HOURS, so a
 * closed tab does not cost anyone their demo. The start is kept in the
 * course's progress record on the API, which follows the account across
 * devices. During prelaunch the API neither stores nor returns progress, so the
 * clock never starts and the demo simply stays open.
 */
export type DemoState =
  | { kind: "none" } // free course, or the learner already has the whole course
  | { kind: "unused" }
  | { kind: "active"; hoursLeft: number }
  | { kind: "expired" };

export function demoState(access: Access, course: AccessCourse, now = Date.now()): DemoState {
  if (course.isFree || hasFullAccess(access, course)) return { kind: "none" };
  const started = Date.parse(access.progress[course.id]?.demoStartedAt ?? "");
  if (!Number.isFinite(started)) return { kind: "unused" };
  const left = started + DEMO_HOURS * 3_600_000 - now;
  return left > 0 ? { kind: "active", hoursLeft: Math.max(1, Math.ceil(left / 3_600_000)) } : { kind: "expired" };
}

/**
 * Whether this learner's assignments go to a reviewer. Free courses and
 * memberships keep review; a paid course bought in the self-study plan does not.
 */
export function hasReview(access: Access, course: AccessCourse): boolean {
  if (!access.signedIn) return false;
  if (course.isFree) return true;
  if (access.tier === "pro" || (access.tier === "club" && course.inClub && !course.isProOnly)) return true;
  return access.courseIds.has(course.id) && !access.selfPlanIds.has(course.id);
}

/** The learner owns the course in the self-study plan and could move up to the mentor plan. */
export function onSelfPlan(access: Access, course: AccessCourse): boolean {
  return access.courseIds.has(course.id) && access.selfPlanIds.has(course.id) && !hasReview(access, course);
}

export function canOpenLesson(access: Access, course: AccessCourse, lessonIndex: number): boolean {
  if (course.isFree || hasFullAccess(access, course)) return true;
  if (lessonIndex === 0) return demoState(access, course).kind !== "expired";
  return false;
}

export function courseCompletion(access: Access, courseId: string, lessonCount: number) {
  const watched = access.progress[courseId]?.watched ?? [];
  const done = new Set(watched).size;
  return { done, total: lessonCount, percent: lessonCount ? Math.round((done / lessonCount) * 100) : 0 };
}
