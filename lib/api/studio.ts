import "server-only";
import { cache } from "react";
import { readAdminToken } from "@/lib/auth/cookies";
import { api, tryApi } from "./http";
import { getCourses } from "./catalog";
import { getStoreCatalog } from "./store";
import { courseBundles } from "@/content/catalog";
import type { Locale } from "@/lib/i18n";

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
  status: "pending" | "accepted" | "resubmit" | string;
  grade?: string | null;
  fileName?: string | null;
  date: string;
  updatedAt: string;
  personal_id?: string;
  /** The learner's account, when one matches the email. */
  userId?: number | null;
  /** Plan held for this course: mentor, self, or null when it is not a purchase (Club, Pro, admin). */
  plan?: "mentor" | "self" | null;
  adminComment?: string | null;
  fileUrl?: string | null;
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

/** An application for «Найди своё в AI», as the API's mapApplication sends it. */
export interface StudioApplication {
  id: string;
  email: string;
  /** Older rows only; new ones carry first and last name. */
  name?: string;
  firstName?: string;
  lastName?: string;
  age?: number | null;
  country?: string;
  telegram?: string;
  /** Option ids — see content/application-options. */
  currentActivity?: string;
  aiExperience?: string;
  interests?: string[];
  source?: string;
  motivation?: string;
  futureGoal?: string;
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
  settings?: {
    paddleEnabled?: boolean;
    paddleEnvironment?: string;
    paddleWebhookUrl?: string;
    tributeWebhookUrl?: string;
    tributeEnabled?: boolean;
  };
}

/* ---------------------------------- roles ---------------------------------- */

/**
 * Which Studio sections each role may open. The API enforces the same split;
 * this only decides what the navigation offers and when a page says
 * "no access" instead of rendering empty panels.
 */
export const STUDIO_ACCESS = {
  pulse: ["admin", "editor", "moderator"],
  queue: ["admin", "moderator"],
  homework: ["admin", "moderator"],
  approved: ["admin", "moderator"],
  logins: ["admin", "moderator"],
  free: ["admin", "editor", "moderator"],
  referrals: ["admin"],
  learners: ["admin", "moderator"],
  support: ["admin", "moderator"],
  orders: ["admin"],
  revenue: ["admin"],
  courses: ["admin", "editor", "moderator"],
  store: ["admin", "editor"],
  content: ["admin", "editor"],
  growth: ["admin"],
  mail: ["admin", "editor", "moderator"],
  ops: ["admin"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type StudioSection = keyof typeof STUDIO_ACCESS;

export function canOpen(role: AdminRole | undefined, section: StudioSection) {
  return Boolean(role && (STUDIO_ACCESS[section] as readonly AdminRole[]).includes(role));
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
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

export const getDataHealth = cache(async () =>
  tryApi<Record<string, unknown>>("/admin/data-health", { admin: true, soft: true }, {}),
);

export interface EmailTemplateInfo {
  id: string;
  kind: "marketing" | "transactional" | string;
  name: { ru: string; ukr?: string; en: string };
}

export interface EmailQueueRow {
  id: string;
  email: string;
  template: string;
  status: string;
  send_after?: string;
  sent_at?: string | null;
  error?: string | null;
  created_at?: string;
}

export interface EmailOverview {
  enabled: boolean;
  counts: { pending: number; sent: number; failed: number; skipped: number; unsubscribed: number };
  byTemplate: { template: string; status: string; c: number }[];
  recent: EmailQueueRow[];
  templates: EmailTemplateInfo[];
}

export const getEmailOverview = cache(async () =>
  tryApi<EmailOverview | null>("/admin/email/overview", { admin: true, soft: true }, null),
);

/* ------------------------------ money and people ----------------------------- */

export interface StudioPayment {
  id: string;
  userId: number | null;
  email: string;
  itemId: string;
  itemTitle: string;
  itemKind: string;
  amount: number;
  currency: string;
  provider: string;
  externalId: string | null;
  status: string;
  /** For a course: the plan bought (self or mentor). */
  plan?: "self" | "mentor" | null;
  createdAt: string;
  completedAt: string | null;
}

export interface StudioRevenue {
  days: number;
  revenue: number;
  orders: number;
  averageOrder: number;
  refunds: { count: number; amount: number };
  byProvider: { provider: string; orders: number; revenue: number }[];
  byItem: { label: string; value: number }[];
  daily: { date: string; value: number }[];
  recent: StudioPayment[];
}

export const getRevenue = cache(async (days = 30) =>
  tryApi<StudioRevenue | null>(`/admin/revenue?days=${days}`, { admin: true, soft: true }, null),
);

export interface StudioPaddle {
  enabled: boolean;
  environment: string;
  webhookSecretSet: boolean;
  webhookUrl: string;
  events: { id: string; event: string; status: string; payload: Record<string, unknown>; createdAt: string }[];
}

export const getPaddleStatus = cache(async () =>
  tryApi<StudioPaddle | null>("/admin/paddle", { admin: true, soft: true }, null),
);

export interface StudioOrder extends StudioPayment {
  licenseTier: string | null;
  granted: { courses: string[]; products: { productId: string; status: string }[] };
}

export async function getOrders(filters: { provider?: string; status?: string; from?: string; to?: string; q?: string }) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return tryApi<{ orders: StudioOrder[]; providers: string[] }>(`/admin/orders${qs ? `?${qs}` : ""}`, { admin: true, soft: true }, { orders: [], providers: [] });
}

export interface StudioUserRow {
  id: number;
  email: string;
  name: string | null;
  personalId: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  purchases: number;
  paid: number;
}

export async function searchUsers(q: string) {
  return tryApi<{ users: StudioUserRow[] }>(`/admin/users?q=${encodeURIComponent(q)}`, { admin: true, soft: true }, { users: [] });
}

export interface StudioUserCard {
  user: { id: number; email: string; name: string | null; personalId: string | null; emailVerified: boolean; createdAt: string; authProvider?: string | null };
  purchases: { id: number; itemId: string; title: string; kind: string; provider: string | null; paymentRef: string | null; purchasedAt: string; plan?: "self" | "mentor" | null }[];
  logins?: StudioLogin[];
  lastLoginAt?: string | null;
  passwordTemporary?: boolean;
  entitlements: { id: string; productId: string; title: string; licenseTier: string; sourceType: string; sourceId: string | null; status: string; grantedAt: string }[];
  payments: StudioPayment[];
  referral: {
    invitedBy: { email: string; code: string; converted: boolean; date: string } | null;
    invited: { email: string; converted: boolean; date: string }[];
  };
  rewards: { code: string; percent: number; kind: string; validFrom: string | null; validUntil: string | null; status: string }[];
  supportMessages: number;
}

export interface StudioLogin {
  id: number;
  userId: number | null;
  email: string | null;
  personalId: string | null;
  method: string;
  ip: string | null;
  userAgent: string | null;
  at: string;
}

export async function getLogins(filters: { q?: string; userId?: string } = {}) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return tryApi<{ logins: StudioLogin[]; last24h: { logins: number; people: number }; last7d: { people: number } }>(
    `/admin/logins${qs ? `?${qs}` : ""}`,
    { admin: true, soft: true },
    { logins: [], last24h: { logins: 0, people: 0 }, last7d: { people: 0 } },
  );
}

export interface FreeViewRow {
  id: string;
  slug: string;
  title: string;
  views: number;
  visitors: number;
  accounts: number;
  started: number;
}

export async function getFreeViews(days = 30) {
  return tryApi<{ days: number; free: FreeViewRow[]; demos: FreeViewRow[]; people: { userId: number; email: string; personalId: string | null; lastSeen: string; views: number }[] } | null>(
    `/admin/free-views?days=${days}`,
    { admin: true, soft: true },
    null,
  );
}

export interface ReferralRow {
  id: number;
  referrerEmail: string;
  referrerId: number | null;
  referrerCode: string | null;
  referredEmail: string;
  referredId: number | null;
  purchased: boolean;
  date: string;
  reward: { code: string | null; status: string | null; validFrom?: string | null; validUntil?: string | null };
}

export async function getReferralList(q = "") {
  return tryApi<{ referrals: ReferralRow[] }>(`/admin/referrals/list${q ? `?q=${encodeURIComponent(q)}` : ""}`, { admin: true, soft: true }, { referrals: [] });
}

export interface SentLetter {
  id: string;
  email: string;
  template: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
}

export async function getSentLetters() {
  return tryApi<{ letters: SentLetter[] }>("/admin/email/sent", { admin: true, soft: true }, { letters: [] });
}

export interface LetterState {
  id: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped" | string;
  sentAt: string | null;
  sendAfter: string | null;
  error: string | null;
}

export interface ApprovedPerson extends StudioApplication {
  userId?: number | null;
  approvedAt: string | null;
  accessGranted?: boolean;
  letters: { application_accepted?: LetterState; todayfree_offer?: LetterState };
}

export async function getApprovedPeople() {
  return tryApi<{ smtp: boolean; people: ApprovedPerson[] }>("/admin/applications/accepted", { admin: true, soft: true }, { smtp: true, people: [] });
}

export async function getUserCard(id: string) {
  return tryApi<StudioUserCard | null>(`/admin/users/${encodeURIComponent(id)}`, { admin: true, soft: true }, null);
}

export interface CodeTally {
  issued: number;
  active: number;
  pending: number;
  used: number;
  expired: number;
  cancelled: number;
}

export interface StudioReferrals {
  invited: number;
  converted: number;
  friendCodes: CodeTally;
  nextCodes: CodeTally;
  reviewCodes: CodeTally;
  topReferrers: { email: string; invited: number; converted: number }[];
}

export const getReferralStats = cache(async () =>
  tryApi<StudioReferrals | null>("/admin/referrals", { admin: true, soft: true }, null),
);

export interface SupportMessage {
  id: string;
  userId: number | null;
  email: string;
  name: string | null;
  message: string;
  reply: string | null;
  status: string;
  date: string;
}

export const getSupportInbox = cache(async () =>
  tryApi<{ messages: SupportMessage[] }>("/admin/support", { admin: true, soft: true }, { messages: [] }),
);

export const getStoreStats = cache(async () =>
  tryApi<{ orders: Record<string, { count: number; revenue: number }>; grants: Record<string, number> }>(
    "/admin/store-stats",
    { admin: true, soft: true },
    { orders: {}, grants: {} },
  ),
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

export async function adminAction(path: string, body?: unknown, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST") {
  return api(path, { admin: true, method, body });
}

/* ------------------------------ item choices ------------------------------- */

export interface StudioItemOption {
  id: string;
  title: string;
  group: "course" | "pack" | "bundle" | "product";
}

/** Everything that can be granted or put in a promo code's scope, grouped for a picker. */
export async function studioItemOptions(locale: Locale): Promise<StudioItemOption[]> {
  const [courses, catalog] = await Promise.all([getCourses(locale, { preview: true }), getStoreCatalog(locale)]);
  return [
    ...courses.filter((course) => course.priceEur > 0).map((course) => ({ id: course.id, title: course.title, group: "course" as const })),
    ...courseBundles.map((pack) => ({ id: pack.id, title: pack.title, group: "pack" as const })),
    ...catalog.bundles.map((bundle) => ({ id: bundle.id, title: bundle.title, group: "bundle" as const })),
    ...catalog.products.map((product) => ({ id: product.id, title: product.title, group: "product" as const })),
  ];
}
