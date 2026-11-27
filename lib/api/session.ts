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
  /** When each lesson (by index) was marked finished; older records lack it. */
  watchedAt?: Record<string, string>;
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
  /** Gifts that apply to this person right now. */
  offers?: { todayFree?: { code: string; endsAt: string } | null };
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

/** The API stores a notification as message/date/targetPath; the cabinet reads title/createdAt/href. */
type RawNotification = Partial<ApiNotification> & { message?: string; date?: string; targetPath?: string | null };

export const getNotifications = cache(async (): Promise<ApiNotification[]> => {
  const payload = await tryApi<RawNotification[] | { notifications?: RawNotification[] }>(
    "/me/notifications",
    { auth: true, soft: true },
    [],
  );
  const rows = Array.isArray(payload) ? payload : (payload.notifications ?? []);
  return rows.map((row) => ({
    id: Number(row.id),
    type: String(row.type ?? ""),
    title: String(row.title ?? row.message ?? ""),
    body: row.body,
    read: Boolean(row.read),
    createdAt: String(row.createdAt ?? row.date ?? ""),
    href: cabinetPath(row.href ?? row.targetPath ?? undefined),
  }));
});

/** Old notifications point at routes the site no longer has; send them to their cabinet equivalents. */
function cabinetPath(target: string | undefined): string | undefined {
  if (!target) return undefined;
  if (/^\/(account|cabinet)(\/|$)/.test(target)) return "/app";
  const course = target.match(/^\/courses\/([^/?#]+)/);
  if (course) return `/learn/${course[1]}`;
  return target.startsWith("/") ? target : undefined;
}

/** The API names the date `date` and the file `fileDataUrl`; the cabinet reads issuedAt/fileUrl. */
type RawCertificate = Partial<ApiCertificate> & { date?: string; fileDataUrl?: string | null };

export const getCertificates = cache(async (): Promise<ApiCertificate[]> => {
  const payload = await tryApi<RawCertificate[] | { certificates?: RawCertificate[] }>(
    "/me/certificates",
    { auth: true, soft: true },
    [],
  );
  const rows = Array.isArray(payload) ? payload : (payload.certificates ?? []);
  return rows.map((row) => ({
    id: String(row.id),
    courseId: String(row.courseId ?? ""),
    courseTitle: String(row.courseTitle ?? ""),
    issuedAt: String(row.issuedAt ?? row.date ?? ""),
    fileUrl: row.fileUrl ?? row.fileDataUrl ?? null,
  }));
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

export interface Payment {
  id: string;
  itemId: string;
  title: string;
  amount: number;
  currency: string;
  status: "completed" | "refunded";
  paidAt: string;
}

/** What the signed-in learner actually paid for, newest first. Null when the API is older than the endpoint. */
export const getPayments = cache(async (): Promise<Payment[] | null> => {
  const payload = await tryApi<Payment[] | { error: string } | null>("/me/payments", { auth: true, soft: true }, null);
  return Array.isArray(payload) ? payload : null;
});

/** Marketplace entitlements are optional: the endpoint can fail independently. */
/** The API answers with a bare array (older builds wrapped it in `items`); both are read. */
type RawEntitlement = { productId: string; license?: string; licenseTier?: string };

export const getEntitlements = cache(async () => {
  const payload = await tryApi<RawEntitlement[] | { items?: RawEntitlement[] } | { error: string }>(
    "/marketplace/me/entitlements",
    { auth: true, soft: true },
    [],
  );
  if (!payload || (!Array.isArray(payload) && "error" in payload)) return [] as { productId: string; license: string }[];
  const rows = Array.isArray(payload) ? payload : (payload.items ?? []);
  return rows.map((row) => ({ productId: row.productId, license: row.license ?? row.licenseTier ?? "personal" }));
});

export const getDownloads = cache(async () => {
  const payload = await tryApi<unknown[] | { items?: unknown[] } | { error: string }>(
    "/marketplace/me/downloads",
    { auth: true, soft: true },
    [],
  );
  if (!payload || (!Array.isArray(payload) && "error" in payload)) return [] as unknown[];
  return Array.isArray(payload) ? payload : (payload.items ?? []);
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

type AccessCourse = { id: string; isFree: boolean; isProOnly: boolean; inClub: boolean; isIntake?: boolean };

/**
 * Open to every signed-in learner without a purchase. The intake («Найди своё
 * в AI») costs nothing but opens only to accepted applicants, who get it as a
 * purchase — so it is free, but not open.
 */
export function openToEveryone(course: AccessCourse): boolean {
  return course.isFree && !course.isIntake;
}

/** The learner has this course in their cabinet: an open free course, bought, or covered by a plan. */
export function ownsCourse(access: Access, course: AccessCourse): boolean {
  return (access.signedIn && openToEveryone(course)) || hasFullAccess(access, course);
}

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
  // The intake has no demo lesson: it opens whole on acceptance.
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
  if (openToEveryone(course) || hasFullAccess(access, course)) return true;
  if (course.isIntake) return false;
  if (lessonIndex === 0) return demoState(access, course).kind !== "expired";
  return false;
}

/** Lessons finished since Monday, across every course — the weekly rhythm. */
export function lessonsThisWeek(access: Access, now = new Date()): number {
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const since = monday.getTime();
  let count = 0;
  for (const progress of Object.values(access.progress)) {
    for (const at of Object.values(progress?.watchedAt ?? {})) if (Date.parse(at) >= since) count++;
  }
  return count;
}

/**
 * The lesson to continue with, 0-based: the first one not yet watched — not
 * "how many are done", which skips a lesson when they were watched out of
 * order. Null when every lesson is done.
 */
export function nextLessonIndex(access: Access, courseId: string, lessonCount: number): number | null {
  const watched = new Set(access.progress[courseId]?.watched ?? []);
  for (let index = 0; index < lessonCount; index++) if (!watched.has(index)) return index;
  return null;
}

export function courseCompletion(access: Access, courseId: string, lessonCount: number) {
  const watched = access.progress[courseId]?.watched ?? [];
  const done = new Set(watched).size;
  return { done, total: lessonCount, percent: lessonCount ? Math.round((done / lessonCount) * 100) : 0 };
}
