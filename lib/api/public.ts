import "server-only";
import { cache } from "react";
import blogContent from "@/content/data/blog.json";
import { field, pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n/config";
import { tryApi } from "./http";
import type {
  ApiBlogPost,
  ApiCalendarEvent,
  ApiFeatureFlags,
  ApiForumCategory,
  ApiForumPost,
  ApiForumTopic,
  ApiGiveaway,
  ApiReview,
} from "./types";

/* --------------------------------- flags ---------------------------------- */

export const getFeatureFlags = cache(async (): Promise<ApiFeatureFlags> => {
  return tryApi<ApiFeatureFlags>(
    "/feature-flags",
    { revalidate: 60 },
    { marketplace: true, vault: true, peerReview: false, emailSequences: true },
  );
});

/* -------------------------------- reviews --------------------------------- */

export interface Review {
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

/** Seed rows from the demo database never reach a public shelf. */
const SEED_AUTHORS = new Set(["test", "test user", "test user (all access)"]);

function isSeed(review: ApiReview) {
  const author = review.userName?.trim().toLowerCase() ?? "";
  const text = review.text?.trim().toLowerCase() ?? "";
  return SEED_AUTHORS.has(author) || ["nice!", "great course", "test"].includes(text);
}

export const getReviews = cache(async (locale: Locale): Promise<Review[]> => {
  const payload = await tryApi<{ reviews?: ApiReview[] }>("/reviews", { revalidate: 300, tags: ["reviews"] }, {});
  return (payload.reviews ?? [])
    .filter((review) => !isSeed(review))
    .map((review) => ({
      id: review.id,
      courseId: review.courseId,
      courseSlug: review.courseSlug,
      courseTitle: field(review as unknown as Record<string, string>, "courseTitle", locale),
      author: review.userName,
      rating: review.rating,
      text: review.text,
      date: review.date,
    }));
});

export async function getCourseReviews(courseId: string, locale: Locale) {
  const reviews = await getReviews(locale);
  const scoped = reviews.filter((review) => review.courseId === courseId);
  const average = scoped.length ? scoped.reduce((sum, review) => sum + review.rating, 0) / scoped.length : 0;
  return { reviews: scoped, average, count: scoped.length };
}

/* ---------------------------------- blog ---------------------------------- */

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readMinutes: number;
  /** Language the Russian-side fields are actually written in. */
  lang: "ru" | "ukr";
  body: string | null;
}

/**
 * The stored `title`/`excerpt` fields are Russian for some rows and Ukrainian
 * for others, which is why the old /ru/blog listed Ukrainian headlines. These
 * letters exist in only one of the two alphabets, so a single pass over the
 * text tells them apart reliably.
 */
function detectLang(text: string): "ru" | "ukr" {
  const ukr = (text.match(/[іїєґІЇЄҐ]/g) ?? []).length;
  const rus = (text.match(/[ыэъёЫЭЪЁ]/g) ?? []).length;
  if (ukr > rus) return "ukr";
  if (rus > ukr) return "ru";
  return /\bта\b|\bякі?\b|\bдля\b\s+\S*ння/.test(text) ? "ukr" : "ru";
}

function toPost(raw: ApiBlogPost & { lang?: string; content?: string; contentEn?: string }, locale: Locale): BlogPost {
  const declared = raw.lang === "ru" || raw.lang === "ukr" ? (raw.lang as "ru" | "ukr") : null;
  return {
    id: raw.id,
    slug: raw.slug,
    title: field(raw as unknown as Record<string, string>, "title", locale),
    excerpt: field(raw as unknown as Record<string, string>, "excerpt", locale),
    category: field(raw as unknown as Record<string, string>, "category", locale),
    date: raw.date,
    readMinutes: raw.readMinutes ?? 3,
    lang: declared ?? detectLang(`${raw.title} ${raw.excerpt}`),
    body: (locale === "en" ? raw.contentEn : raw.content) ?? null,
  };
}

const localPosts = blogContent.blogPosts as unknown as ApiBlogPost[];

export const getAllBlogPosts = cache(async (locale: Locale): Promise<BlogPost[]> => {
  const remote = await tryApi<ApiBlogPost[]>("/blog", { revalidate: 600, tags: ["blog"] }, []);
  const bySlug = new Map<string, ApiBlogPost>();
  for (const post of [...localPosts, ...remote]) bySlug.set(post.slug, { ...bySlug.get(post.slug), ...post });
  return [...bySlug.values()].map((post) => toPost(post, locale)).sort((a, b) => b.date.localeCompare(a.date));
});

/**
 * English reads every article (each row carries an English title); the Slavic
 * locales only get the rows actually written in their language.
 */
export const getBlogPosts = cache(async (locale: Locale): Promise<BlogPost[]> => {
  const posts = await getAllBlogPosts(locale);
  if (locale === "en") return posts;
  return posts.filter((post) => post.lang === locale);
});

/** Articles that exist, but only in the other Slavic language. */
export async function getOtherLanguagePosts(locale: Locale): Promise<BlogPost[]> {
  if (locale === "en") return [];
  const posts = await getAllBlogPosts(locale);
  return posts.filter((post) => post.lang !== locale);
}

export async function getBlogPost(slug: string, locale: Locale) {
  const posts = await getAllBlogPosts(locale);
  const index = posts.findIndex((post) => post.slug === slug);
  if (index < 0) return null;
  const post = posts[index];
  return {
    post,
    prev: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
    related: posts.filter((item, i) => i !== index && item.category === post.category).slice(0, 3),
  };
}

/* ---------------------------------- forum --------------------------------- */

export const getForumCategories = cache(async (locale: Locale) => {
  const payload = await tryApi<{ categories?: ApiForumCategory[] }>("/forum/categories", { revalidate: 600 }, {});
  return (payload.categories ?? []).map((category) => ({
    id: category.id,
    label: pick(locale, category.ru, category.en),
  }));
});

export async function getForumTopics(categoryId?: string) {
  const query = categoryId && categoryId !== "all" ? `?category=${encodeURIComponent(categoryId)}` : "";
  const payload = await tryApi<{ topics?: ApiForumTopic[]; total?: number }>(`/forum/topics${query}`, { revalidate: 30 }, {});
  return { topics: payload.topics ?? [], total: payload.total ?? payload.topics?.length ?? 0 };
}

export async function getForumTopic(slug: string) {
  return tryApi<{ topic: ApiForumTopic; posts: ApiForumPost[] } | null>(
    `/forum/topics/${encodeURIComponent(slug)}`,
    { revalidate: 15 },
    null,
  );
}

/* -------------------------------- giveaways -------------------------------- */

export const getGiveaways = cache(async (): Promise<ApiGiveaway[]> => {
  return tryApi<ApiGiveaway[]>("/giveaways", { auth: true, soft: true }, []);
});

export async function getGiveaway(slug: string): Promise<ApiGiveaway | null> {
  return tryApi<ApiGiveaway | null>(`/giveaways/${encodeURIComponent(slug)}`, { auth: true, soft: true }, null);
}

/* -------------------------------- calendar --------------------------------- */

export const getCalendar = cache(async (locale: Locale) => {
  const events = await tryApi<ApiCalendarEvent[]>("/calendar", { revalidate: 300, tags: ["calendar"] }, []);
  return events.map((event) => ({
    id: event.id,
    title: field(event as unknown as Record<string, string>, "title", locale),
    description: field(event as unknown as Record<string, string>, "description", locale),
    date: event.date,
    type: event.type,
  }));
});
