import "server-only";
import { cache } from "react";
import { readAdminToken } from "@/lib/auth/cookies";
import { api, tryApi } from "./http";

export type AdminRole = "admin" | "editor" | "moderator";

export interface StudioUser {
  id: number;
  email: string;
  name: string;
  personalId?: string;
  emailVerified?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  telegramChatId?: string | null;
}

export interface StudioHomework {
  id: string;
  email: string;
  name: string;
  courseId: string;
  courseTitle: string;
  lessonIndex: number;
  lessonTitle: string;
  content: string;
  status: "pending" | "accepted" | "rework" | string;
  grade?: string | null;
  fileName?: string | null;
  date: string;
  updatedAt: string;
  personal_id?: string;
}

export interface StudioReview {
  id: string;
  courseId: string;
  courseTitle?: string;
  userName: string;
  rating: number;
  text: string;
  status?: string;
  date: string;
}

export interface StudioApplication {
  id: string;
  email: string;
  name: string;
  status: string;
  track?: string;
  date: string;
}

export interface StudioPurchase {
  id: string;
  email: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  date: string;
}

export interface StudioRegistration {
  id: number;
  email: string;
  name?: string;
  date: string;
}

export interface StudioDashboard {
  role: AdminRole;
  analytics: { visits: number; courseClicks: Record<string, number> };
  dailyVisits: Record<string, number>;
  charts?: unknown;
  courses: unknown[];
  blog: unknown[];
  calendar: unknown[];
  registrations?: StudioRegistration[];
  users?: StudioUser[];
  purchases?: StudioPurchase[];
  certificates?: { id: string; email: string; courseTitle: string; date: string }[];
  homework?: StudioHomework[];
  referrals?: { referrer_email: string; referred_email: string; date: string }[];
  discounts?: Record<string, number>;
  reviews?: StudioReview[];
  applications?: StudioApplication[];
  teams?: { id: number; name: string; invite_code: string; created_at: string }[];
  webhookLog?: { id: string; event_name: string; status: string; created_at: string }[];
  settings?: { tributeWebhookUrl: string; tributeEnabled: boolean };
}

export async function hasAdminSession() {
  return Boolean(await readAdminToken());
}

/** Everything the Studio needs arrives in one authenticated payload. */
export const getStudioDashboard = cache(async (): Promise<StudioDashboard | null> => {
  return tryApi<StudioDashboard | null>("/admin/dashboard", { admin: true, soft: true }, null);
});

export const getPromoCodes = cache(async () =>
  tryApi<{ codes?: unknown[] } | unknown[]>("/admin/promo-codes", { admin: true, soft: true }, []),
);

export const getFeatureFlagsAdmin = cache(async () =>
  tryApi<Record<string, boolean>>("/admin/feature-flags", { admin: true, soft: true }, {}),
);

export const getAuditLog = cache(async () =>
  tryApi<{ entries?: AuditEntry[] } | AuditEntry[]>("/admin/audit-log", { admin: true, soft: true }, []),
);

export interface AuditEntry {
  id: number | string;
  actor?: string;
  action: string;
  target?: string;
  createdAt?: string;
  created_at?: string;
}

export const getDataHealth = cache(async () =>
  tryApi<Record<string, unknown>>("/admin/data-health", { admin: true, soft: true }, {}),
);

export const getCreatorPayouts = cache(async () =>
  tryApi<{ payouts?: unknown[] } | unknown[]>("/admin/creator-payouts", { admin: true, soft: true }, []),
);

export const getGovernance = cache(async () =>
  tryApi<Record<string, unknown>>("/governance/dashboard", { admin: true, soft: true }, {}),
);

/* -------------------------------------------------------------------------- */

/** Counts that drive the "needs a decision" chips in the Studio sidebar. */
export function queueCounts(dashboard: StudioDashboard | null) {
  if (!dashboard) return { homework: 0, applications: 0, reviews: 0, total: 0 };
  const homework = (dashboard.homework ?? []).filter((item) => item.status === "pending").length;
  const applications = (dashboard.applications ?? []).filter((item) => item.status === "pending" || item.status === "new").length;
  const reviews = (dashboard.reviews ?? []).filter((item) => (item.status ?? "pending") === "pending").length;
  return { homework, applications, reviews, total: homework + applications + reviews };
}

/** Daily visit series, oldest first, for the pulse sparkline. */
export function visitSeries(dashboard: StudioDashboard | null, days = 30) {
  const source = dashboard?.dailyVisits ?? {};
  const entries = Object.entries(source)
    .map(([date, value]) => ({ date, value: Number(value) || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return entries.slice(-days);
}

export function revenueSeries(dashboard: StudioDashboard | null, days = 30) {
  const byDate = new Map<string, number>();
  for (const purchase of dashboard?.purchases ?? []) {
    const day = purchase.date?.slice(0, 10);
    if (!day) continue;
    byDate.set(day, (byDate.get(day) ?? 0) + Number(purchase.amount || 0));
  }
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

export async function adminAction(path: string, body?: unknown, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST") {
  return api(path, { admin: true, method, body });
}
